const Lead = require('../models/Lead');
const User = require('../models/User');
const GlobalConfig = require('../models/GlobalConfig');
const Booking = require('../models/Booking');
const { formatDoc } = require('../utils/helpers');
const { ensureCurrentMonthMetrics, recordBookingForAgents } = require('./agentService');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { generateBookingId, generatePaymentId } = require('../controllers/bookingController');

async function getLeads(agentIdCondition = undefined) {
  let leads = await Lead.findAll();
  if (agentIdCondition !== undefined) {
    if (Array.isArray(agentIdCondition)) {
      leads = leads.filter(lead => lead.agentIds && lead.agentIds.some(id => agentIdCondition.includes(id)));
    } else {
      leads = leads.filter(lead => lead.agentIds && lead.agentIds.includes(agentIdCondition));
    }
  }

  const formattedLeads = leads.map(formatDoc);

  // Dynamically fetch and stitch bookings
  try {
    const leadIdSet = new Set();
    formattedLeads.forEach(l => {
      if (l._id) leadIdSet.add(l._id.toString());
      if (l.id) leadIdSet.add(l.id.toString());
      if (l.leadId !== undefined && l.leadId !== null) {
        leadIdSet.add(l.leadId.toString());
      }
    });

    const leadIds = Array.from(leadIdSet);
    const bookings = leadIds.length > 0 ? await Booking.find({ leadId: { $in: leadIds } }).lean() : [];

    const bookingsMap = {};
    bookings.forEach(b => {
      const bKey = b.leadId ? b.leadId.toString() : null;
      if (bKey) {
        if (!bookingsMap[bKey]) bookingsMap[bKey] = [];
        bookingsMap[bKey].push(b);
      }
    });

    formattedLeads.forEach(l => {
      const possibleKeys = [
        l._id ? l._id.toString() : null,
        l.id ? l.id.toString() : null,
        l.leadId !== undefined && l.leadId !== null ? l.leadId.toString() : null
      ].filter(Boolean);

      let matchedBookings = [];
      possibleKeys.forEach(key => {
        if (bookingsMap[key]) {
          matchedBookings = matchedBookings.concat(bookingsMap[key]);
        }
      });

      const legacyTrips = Array.isArray(l.trips) ? l.trips : [];
      const seen = new Set();
      const mergedTrips = [];

      matchedBookings.forEach(b => {
        const bId = b.bookingId || (b._id && b._id.toString());
        if (bId && !seen.has(bId.toString())) {
          seen.add(bId.toString());
          mergedTrips.push(b);
        }
      });

      legacyTrips.forEach(t => {
        if (t && typeof t === 'object') {
          const tId = t.bookingId || (t._id && t._id.toString()) || t.id;
          if (!tId || !seen.has(tId.toString())) {
            if (tId) seen.add(tId.toString());
            mergedTrips.push(t);
          }
        }
      });

      l.trips = mergedTrips;
    });
  } catch (err) {
    console.error('Failed to fetch and stitch bookings in getLeads:', err);
    formattedLeads.forEach(l => { l.trips = []; });
  }

  return formattedLeads;
}

async function createLead(name, phone, age, origin, destination, leadSource, mailId, product, createdByUser) {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error("Phone number must be exactly 10 digits with no spaces");
  }

  const existingPhone = await Lead.Model.findOne({ phone: cleanPhone });
  if (existingPhone) {
    throw new Error("A lead with this phone number already exists.");
  }

  if (mailId) {
    const existingMail = await Lead.Model.findOne({ mailId });
    if (existingMail) {
      throw new Error("A lead with this email already exists.");
    }
  }

  let createdBy = { name: '', email: '' };
  if (createdByUser && createdByUser.userId) {
    const user = await User.findById(createdByUser.userId);
    if (user) {
      createdBy.name = user.name || '';
      createdBy.email = user.email || '';
    }
  }

  const lead = {
    name: name ? name.trim() || 'NA' : 'NA',
    phone: cleanPhone,
    age: age ? Number(age) : undefined,
    origin: origin || '',
    destination: destination || '',
    leadSource: leadSource || '',
    product: product || '',
    agentIds: [],
    notes: [],
    createdBy
  };

  if (mailId && mailId.trim() !== '') {
    lead.mailId = mailId.trim();
  }

  let result;
  try {
    result = await Lead.insertLead(lead);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.phone) {
        throw new Error("A lead with this phone number already exists.");
      }
      if (error.keyPattern && error.keyPattern.mailId) {
        throw new Error("A lead with this email already exists.");
      }
    }
    throw error;
  }
  const newLead = await Lead.findById(result.insertedId);
  return formatDoc(newLead);
}

async function updateLead(id, name, phone, age, origin, destination, leadSource, mailId, product, agentIdCondition, travelDate, numberOfPersons) {
  const existingLead = await Lead.findById(id);
  if (!existingLead) {
    throw new Error("Lead not found or unauthorized");
  }

  const finalPhone = phone !== undefined ? phone : existingLead.phone;
  if (!finalPhone) {
    throw new Error("Phone number is required");
  }

  const cleanPhone = finalPhone.replace(/\s+/g, '');
  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error("Phone number must be exactly 10 digits with no spaces");
  }

  const updatePayload = {
    name: name !== undefined ? (name ? name.trim() || 'NA' : 'NA') : (existingLead.name || 'NA'),
    phone: cleanPhone,
    age: age !== undefined ? (age ? Number(age) : undefined) : existingLead.age,
    origin: origin !== undefined ? origin : (existingLead.origin || ''),
    destination: destination !== undefined ? destination : (existingLead.destination || ''),
    leadSource: leadSource !== undefined ? leadSource : (existingLead.leadSource || ''),
    product: product !== undefined ? product : (existingLead.product || '')
  };

  if (travelDate !== undefined) {
    if (travelDate === null || String(travelDate).trim() === '') {
      updatePayload.travelDate = '';
    } else {
      const strDate = String(travelDate).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(strDate)) {
        throw new Error("Invalid travel date format. Must be a valid YYYY-MM-DD date.");
      }
      const [y, m, d] = strDate.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      if (dateObj.getUTCFullYear() !== y || dateObj.getUTCMonth() + 1 !== m || dateObj.getUTCDate() !== d) {
        throw new Error("Invalid travel date. Date does not exist in calendar.");
      }
      updatePayload.travelDate = strDate;
    }
  }
  if (numberOfPersons !== undefined) {
    if (numberOfPersons === null || String(numberOfPersons).trim() === '') {
      updatePayload.numberOfPersons = null;
    } else {
      const numVal = Number(numberOfPersons);
      if (!Number.isSafeInteger(numVal) || numVal < 1) {
        throw new Error("Number of persons must be a positive integer (at least 1).");
      }
      updatePayload.numberOfPersons = numVal;
    }
  }

  const finalMailId = mailId !== undefined ? mailId : existingLead.mailId;
  if (finalMailId && finalMailId.trim() !== '') {
    updatePayload.mailId = finalMailId.trim();
  } else if (mailId !== undefined && (!finalMailId || finalMailId.trim() === '')) {
    updatePayload.$unset = { mailId: 1 };
  }

  let result;
  try {
    result = await Lead.updateLead(id, updatePayload, agentIdCondition);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.phone) {
        throw new Error("A lead with this phone number already exists.");
      }
      if (error.keyPattern && error.keyPattern.mailId) {
        throw new Error("A lead with this email already exists.");
      }
      throw new Error("A lead with this phone number or email already exists.");
    }
    throw error;
  }

  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }

  return await getLeadById(id, agentIdCondition);
}

async function assignLead(id, agentIds) {
  const updateVal = Array.isArray(agentIds) ? agentIds : (agentIds ? [agentIds] : []);
  
  // Enforce single agent assignment
  if (updateVal.length > 1) {
    throw new Error("A lead can only be assigned to one agent at a time.");
  }

  // Verify all agents are verified before assigning
  if (updateVal.length > 0) {
    for (const agentId of updateVal) {
      const agent = await User.findById(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      if (!agent.isVerified) {
        throw new Error(`Cannot assign lead to unverified agent: ${agent.name}`);
      }
      if (agent.status !== 'Active') {
        throw new Error(`Cannot assign lead to inactive agent: ${agent.name}`);
      }
      if (agent.isAdmin) {
        throw new Error(`Cannot assign lead to an admin user: ${agent.name}`);
      }
    }
  }

  const result = await Lead.updateLead(id, { agentIds: updateVal });

  if (!result) {
    throw new Error("Lead not found");
  }

  return await getLeadById(id);
}

async function addNote(id, text, userId, imageUrl, agentIdCondition) {
  if ((!text || !text.trim()) && !imageUrl) {
    throw new Error("Note text or image is required");
  }

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }
  
  if (agentIdCondition !== undefined) {
    const isAuthorized = Array.isArray(agentIdCondition)
      ? (lead.agentIds || []).some(id => agentIdCondition.includes(id))
      : (lead.agentIds || []).includes(agentIdCondition);
    if (!isAuthorized) {
      throw new Error("Lead not found or unauthorized");
    }
  }

  let author = 'System/Admin';
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      author = user.name;
    }
  }

  const newNote = {
    id: new mongoose.Types.ObjectId().toString(),
    text: (text || '').trim(),
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
    author,
    authorId: userId || null,
    imageUrl: imageUrl || null
  };

  const result = await Lead.pushNote(id, newNote, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function deleteNote(id, noteId, userId, isAdmin, agentIdCondition) {
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }
  
  if (agentIdCondition !== undefined) {
    const isAuthorized = Array.isArray(agentIdCondition)
      ? (lead.agentIds || []).some(id => agentIdCondition.includes(id))
      : (lead.agentIds || []).includes(agentIdCondition);
    if (!isAuthorized) {
      throw new Error("Lead not found or unauthorized");
    }
  }

  const note = lead.notes.find(n => n.id === noteId || (n._id && n._id.toString() === noteId));
  if (!note) {
    throw new Error("Note not found");
  }

  if (!isAdmin && (!note.authorId || note.authorId !== userId)) {
    throw new Error("Unauthorized to delete this note");
  }

  const result = await Lead.deleteNote(id, noteId, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function getLeadById(id, agentIdCondition = undefined) {
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }

  if (agentIdCondition !== undefined) {
    const isAuthorized = Array.isArray(agentIdCondition)
      ? (lead.agentIds || []).some(id => agentIdCondition.includes(id))
      : (lead.agentIds || []).includes(agentIdCondition);
    if (!isAuthorized) {
      throw new Error("Lead not found or unauthorized");
    }
  }

  const formattedLead = formatDoc(lead);

  // Dynamically fetch and stitch bookings
  try {
    const possibleKeys = [
      formattedLead._id ? formattedLead._id.toString() : null,
      formattedLead.id ? formattedLead.id.toString() : null,
      formattedLead.leadId !== undefined && formattedLead.leadId !== null ? formattedLead.leadId.toString() : null
    ].filter(Boolean);

    const bookings = await Booking.find({ leadId: { $in: possibleKeys } }).lean();
    
    const legacyTrips = Array.isArray(formattedLead.trips) ? formattedLead.trips : [];
    const seen = new Set();
    const mergedTrips = [];

    (bookings || []).forEach(b => {
      const bId = b.bookingId || (b._id && b._id.toString());
      if (bId && !seen.has(bId.toString())) {
        seen.add(bId.toString());
        mergedTrips.push(b);
      }
    });

    legacyTrips.forEach(t => {
      if (t && typeof t === 'object') {
        const tId = t.bookingId || (t._id && t._id.toString()) || t.id;
        if (!tId || !seen.has(tId.toString())) {
          if (tId) seen.add(tId.toString());
          mergedTrips.push(t);
        }
      }
    });

    formattedLead.trips = mergedTrips;
  } catch (err) {
    console.error('Failed to fetch and stitch bookings in getLeadById:', err);
    formattedLead.trips = [];
  }

  return formattedLead;
}

async function updateLabels(id, labels, agentIdCondition) {
  const result = await Lead.updateLead(id, { labels: labels || [] }, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function updateDates(id, dates, agentIdCondition) {
  const updateData = {};
  if (dates.startDate !== undefined) {
    if (dates.startDate) {
      const startDate = new Date(dates.startDate);
      if (isNaN(startDate.getTime())) {
        throw new Error("Invalid start date");
      }
      updateData['dates.startDate'] = startDate;
    } else {
      updateData['dates.startDate'] = null;
    }
  }
  if (dates.dueDate !== undefined) {
    if (dates.dueDate) {
      const dueDate = new Date(dates.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new Error("Invalid due date");
      }
      updateData['dates.dueDate'] = dueDate;
    } else {
      updateData['dates.dueDate'] = null;
    }
  }
  const result = await Lead.updateLead(id, updateData, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function updateReminder(id, reminderDate, agentIdCondition) {
  let parsedDate = null;
  if (reminderDate) {
    parsedDate = new Date(reminderDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid reminder date");
    }
  }
  const result = await Lead.updateLead(id, { 'dates.reminderDate': parsedDate }, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function updateStatus(id, status, agentIdCondition) {
  let validStatuses = ['Fresh Leads', 'Interested Leads', 'Pre Prospect Leads', 'Prospect Leads', 'Booked', 'Rejected Leads'];
  try {
    const config = await GlobalConfig.findOne({ key: 'GLOBAL_SETTINGS' });
    if (config && Array.isArray(config.statuses) && config.statuses.length > 0) {
      validStatuses = config.statuses;
    }
  } catch (err) {
    console.error("Error fetching global config statuses in updateStatus:", err);
  }

  const trimmedStatus = typeof status === 'string' ? status.trim() : '';
  if (!trimmedStatus || !validStatuses.includes(trimmedStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  const result = await Lead.updateLead(id, { status: trimmedStatus }, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

async function bookLead(id, bookingDetails, agentIdCondition) {
  const existingLead = await Lead.findById(id);
  if (!existingLead) {
    throw new Error("Lead not found or unauthorized");
  }

  if (!bookingDetails || typeof bookingDetails !== 'object') {
    throw new Error("Invalid booking details");
  }

  const hasPaxField = bookingDetails.noOfPax !== undefined || bookingDetails.adults !== undefined || bookingDetails.numberOfPersons !== undefined;
  if (!hasPaxField) {
    throw new Error("Passenger count ('noOfPax', 'adults', or 'numberOfPersons') is required for booking.");
  }

  const requiredFields = [
    'fullName', 'emailId', 'contactNumber', 'emergencyContactNumber',
    'packageName', 'startDate', 'endDate', 'totalAmount', 'paidAmount', 'dueAmount'
  ];

  const numericFields = ['totalAmount', 'paidAmount', 'dueAmount'];
  const dateFields = ['startDate', 'endDate'];

  for (const field of requiredFields) {
    const val = bookingDetails[field];
    if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
      throw new Error(`The field '${field}' is required for booking.`);
    }

    if (numericFields.includes(field)) {
      const num = Number(val);
      if (!Number.isFinite(num)) {
        throw new Error(`The field '${field}' must be a valid finite number.`);
      }
    }

    if (dateFields.includes(field)) {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        throw new Error(`The field '${field}' must be a valid date.`);
      }
    }
  }

  const trimString = (val) => (typeof val === 'string' ? val.trim() : String(val || ''));
  const fullName = trimString(bookingDetails.fullName);
  const packageName = trimString(bookingDetails.packageName);
  const contactNumber = trimString(bookingDetails.contactNumber);
  const emailId = trimString(bookingDetails.emailId);
  const emergencyContactNumber = trimString(bookingDetails.emergencyContactNumber);
  const tripIdInput = trimString(bookingDetails.tripId);

  const startDate = new Date(bookingDetails.startDate);
  const endDate = new Date(bookingDetails.endDate);

  const totalAmount = Number(bookingDetails.totalAmount);
  const paidAmount = Number(bookingDetails.paidAmount);

  const rawChildren = bookingDetails.children !== undefined ? Number(bookingDetails.children) : 0;
  const numChildren = (!isNaN(rawChildren) && rawChildren >= 0) ? rawChildren : 0;

  const rawAdults = bookingDetails.adults !== undefined ? Number(bookingDetails.adults) : (bookingDetails.noOfPax !== undefined ? Number(bookingDetails.noOfPax) : (bookingDetails.numberOfPersons !== undefined ? Number(bookingDetails.numberOfPersons) : undefined));
  let numAdults;
  if (rawAdults !== undefined && !isNaN(rawAdults) && rawAdults >= 0) {
    numAdults = rawAdults;
  } else {
    numAdults = numChildren > 0 ? 0 : 1;
  }
  if (numAdults === 0 && numChildren === 0) {
    numAdults = 1;
  }
  const noOfPax = numAdults + numChildren;

  const sanitizedBookingDetails = {
    ...bookingDetails,
    fullName,
    packageName,
    contactNumber,
    emailId,
    emergencyContactNumber,
    startDate,
    endDate,
    totalAmount,
    paidAmount,
    dueAmount,
    noOfPax,
    adults: numAdults,
    children: numChildren
  };

  // Create or update standalone Booking document in ft_booking_system
  const bookingId = bookingDetails.bookingId || (await generateBookingId());
  const paymentId = bookingDetails.paymentId || (await generatePaymentId());
  const transactionId = bookingDetails.transactionId || ('TXN-' + crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase());

  const assignedAgents = (Array.isArray(existingLead.agentIds) && existingLead.agentIds.length > 0)
    ? existingLead.agentIds
    : [];

  const createdByUser = (agentIdCondition && !Array.isArray(agentIdCondition))
    ? agentIdCondition
    : (Array.isArray(agentIdCondition) && agentIdCondition[0]) || (assignedAgents[0] || null);

  const newBooking = new Booking({
    bookingId,
    paymentId,
    leadId: existingLead._id.toString(),
    startDate,
    endDate,
    packageName,
    location: bookingDetails.location || existingLead.destination || 'N/A',
    totalAmount,
    paidAmount,
    dueAmount,
    transactionId,
    screenshot: bookingDetails.screenshot || '',
    travellerName: fullName || existingLead.name || 'Traveller',
    travellerEmail: emailId || existingLead.mailId || 'traveller@example.com',
    travellerPhone: contactNumber || existingLead.phone,
    status: 'Booked',
    tripStatus: 'Booked',
    assignedTo: assignedAgents,
    createdBy: createdByUser,
    adults: numAdults,
    children: numChildren
  });

  const updateData = {
    status: 'Booked'
  };

  if (fullName) updateData.name = fullName;
  if (packageName) updateData.product = packageName;

  let result;
  try {
    result = await Lead.updateLead(id, updateData, agentIdCondition);
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.phone) {
        throw new Error("A lead with this phone number already exists.");
      }
      if (error.keyPattern && error.keyPattern.mailId) {
        throw new Error("A lead with this email already exists.");
      }
      throw new Error("A lead with this phone number or email already exists.");
    }
    throw error;
  }
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }

  try {
    await newBooking.save();
  } catch (saveError) {
    if (saveError.code === 11000) {
      const isTxn = (saveError.keyPattern && saveError.keyPattern.transactionId) || (saveError.errmsg && saveError.errmsg.includes('transactionId')) || (saveError.message && saveError.message.includes('transactionId'));
      const isBkg = (saveError.keyPattern && saveError.keyPattern.bookingId) || (saveError.errmsg && saveError.errmsg.includes('bookingId')) || (saveError.message && saveError.message.includes('bookingId'));
      const isPay = (saveError.keyPattern && saveError.keyPattern.paymentId) || (saveError.errmsg && saveError.errmsg.includes('paymentId')) || (saveError.message && saveError.message.includes('paymentId'));

      if (isTxn) throw new Error('Transaction ID must be unique across all bookings.');
      if (isBkg) throw new Error('Booking ID must be unique.');
      if (isPay) throw new Error('Payment ID must be unique.');
      throw new Error('A booking with this unique key already exists.');
    }
    throw saveError;
  }

  // Increment booking count & targetCompleted for assigned agents if lead was not previously booked
  if (existingLead.status !== 'Booked' && Array.isArray(existingLead.agentIds) && existingLead.agentIds.length > 0) {
    const totalAmount = Number(bookingDetails.totalAmount) || 0;
    await recordBookingForAgents(existingLead.agentIds, totalAmount);
  }

  return await getLeadById(id, agentIdCondition);
}

async function updateBooking(id, bookingData, agentIdCondition) {
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const currentBooking = lead.booking || {};

  const totalDial = bookingData.totalDial !== undefined ? (Number(bookingData.totalDial) || 0) : (currentBooking.totalDial || 0);
  const dailyDial = bookingData.dailyDial !== undefined ? (Number(bookingData.dailyDial) || 0) : (currentBooking.dailyDial || 0);
  const connected = bookingData.connected !== undefined ? (Number(bookingData.connected) || 0) : (currentBooking.connected || 0);
  const talkTime = bookingData.talkTime !== undefined ? (bookingData.talkTime || '0:0') : (currentBooking.talkTime || '0:0');
  const dailyTalkTime = bookingData.dailyTalkTime !== undefined ? (bookingData.dailyTalkTime || '0:0') : (currentBooking.dailyTalkTime || '0:0');

  let firstCall = currentBooking.firstCall || null;
  if (bookingData.firstCall !== undefined) {
    if (bookingData.firstCall) {
      const d = new Date(bookingData.firstCall);
      if (isNaN(d.getTime())) throw new Error("Invalid firstCall date");
      firstCall = d;
    } else {
      firstCall = null;
    }
  }

  let lastCall = currentBooking.lastCall || null;
  if (bookingData.lastCall !== undefined) {
    if (bookingData.lastCall) {
      const d = new Date(bookingData.lastCall);
      if (isNaN(d.getTime())) throw new Error("Invalid lastCall date");
      lastCall = d;
    } else {
      lastCall = null;
    }
  }

  // Check if any changes were actually made. If not, bypass the update.
  const hasChanges =
    totalDial !== (currentBooking.totalDial || 0) ||
    dailyDial !== (currentBooking.dailyDial || 0) ||
    connected !== (currentBooking.connected || 0) ||
    talkTime !== (currentBooking.talkTime || '0:0') ||
    dailyTalkTime !== (currentBooking.dailyTalkTime || '0:0') ||
    (firstCall ? new Date(firstCall).getTime() : null) !== (currentBooking.firstCall ? new Date(currentBooking.firstCall).getTime() : null) ||
    (lastCall ? new Date(lastCall).getTime() : null) !== (currentBooking.lastCall ? new Date(currentBooking.lastCall).getTime() : null);

  if (!hasChanges) {
    // If agentIdCondition is set, we must also ensure the current agent is still the owner
    if (agentIdCondition !== undefined && !(lead.agentIds || []).includes(agentIdCondition)) {
      throw new Error("Lead not found or unauthorized");
    }
    return await getLeadById(id, agentIdCondition);
  }

  // Manage callLogs for the current date in IST (Asia/Kolkata)
  // Use Intl.DateTimeFormat for reliable IST date, regardless of server timezone
  const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  
  let query = {};
  if (mongoose.Types.ObjectId.isValid(id) && typeof id === 'string' && id.length === 24) {
    query = { _id: id };
  } else {
    query = { leadId: Number(id) };
  }
  if (agentIdCondition !== undefined) {
    query.agentIds = agentIdCondition;
  }

  const baseSet = {
    'booking.totalDial': totalDial,
    'booking.dailyDial': dailyDial,
    'booking.connected': connected,
    'booking.talkTime': talkTime,
    'booking.dailyTalkTime': dailyTalkTime,
    'booking.firstCall': firstCall,
    'booking.lastCall': lastCall
  };

  let result = await Lead.Model.findOneAndUpdate(
    { ...query, 'callLogs.date': todayDate },
    {
      $set: {
        ...baseSet,
        'callLogs.$.dailyDial': dailyDial,
        'callLogs.$.dailyTalkTime': dailyTalkTime
      }
    },
    { new: true }
  );

  if (!result) {
    result = await Lead.Model.findOneAndUpdate(
      query,
      {
        $set: baseSet,
        $push: { callLogs: { date: todayDate, dailyDial, dailyTalkTime } }
      },
      { new: true }
    );
  }

  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return await getLeadById(id, agentIdCondition);
}

module.exports = {
  getLeads,
  createLead,
  updateLead,
  assignLead,
  addNote,
  deleteNote,
  getLeadById,
  updateLabels,
  updateDates,
  updateReminder,
  updateStatus,
  bookLead,
  updateBooking
};
