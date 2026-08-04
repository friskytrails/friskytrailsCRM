const Lead = require('../models/Lead');
const User = require('../models/User');
const GlobalConfig = require('../models/GlobalConfig');
const { formatDoc } = require('../utils/helpers');
const { ensureCurrentMonthMetrics } = require('./agentService');
const mongoose = require('mongoose');

async function getLeads(agentIdCondition = undefined) {
  let leads = await Lead.findAll();
  if (agentIdCondition !== undefined) {
    if (Array.isArray(agentIdCondition)) {
      leads = leads.filter(lead => lead.agentIds && lead.agentIds.some(id => agentIdCondition.includes(id)));
    } else {
      leads = leads.filter(lead => lead.agentIds && lead.agentIds.includes(agentIdCondition));
    }
  }
  return leads.map(formatDoc);
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

async function updateLead(id, name, phone, age, origin, destination, leadSource, mailId, product, agentIdCondition) {
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

  return formatDoc(result);
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

  return formatDoc(result);
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
  return formatDoc(result);
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
  return formatDoc(result);
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

  return formatDoc(lead);
}

async function updateLabels(id, labels, agentIdCondition) {
  const result = await Lead.updateLead(id, { labels: labels || [] }, agentIdCondition);
  if (!result) {
    throw new Error("Lead not found or unauthorized");
  }
  return formatDoc(result);
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
  return formatDoc(result);
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
  return formatDoc(result);
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
  return formatDoc(result);
}

async function bookLead(id, bookingDetails, agentIdCondition) {
  const existingLead = await Lead.findById(id);
  if (!existingLead) {
    throw new Error("Lead not found or unauthorized");
  }

  if (!bookingDetails || typeof bookingDetails !== 'object') {
    throw new Error("Invalid booking details");
  }

  const requiredFields = [
    'fullName', 'emailId', 'contactNumber', 'emergencyContactNumber',
    'packageName', 'startDate', 'endDate', 'totalAmount', 'paidAmount', 'dueAmount', 'noOfPax'
  ];

  const numericFields = ['totalAmount', 'paidAmount', 'dueAmount', 'noOfPax'];
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
  const dueAmount = Number(bookingDetails.dueAmount);
  const noOfPax = Number(bookingDetails.noOfPax);

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
    noOfPax
  };

  const tripObj = {
    tripId: tripIdInput || ('TRIP-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
    packageName,
    startDate,
    endDate,
    totalAmount,
    paidAmount,
    dueAmount,
    noOfPax,
    fullName,
    contactNumber,
    emailId,
    emergencyContactNumber,
    bookedAt: new Date(),
    status: 'Booked'
  };

  let tripsList = existingLead.trips ? [...existingLead.trips] : [];
  
  if (bookingDetails.tripIndex !== undefined && bookingDetails.tripIndex !== null && Number(bookingDetails.tripIndex) >= 0 && Number(bookingDetails.tripIndex) < tripsList.length) {
    const idx = Number(bookingDetails.tripIndex);
    tripsList[idx] = { ...tripsList[idx], ...tripObj, tripId: tripsList[idx].tripId || tripObj.tripId };
  } else {
    tripsList.push(tripObj);
  }

  const updateData = {
    status: 'Booked',
    bookingDetails: sanitizedBookingDetails,
    trips: tripsList
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

  // Increment booking count for assigned agents if lead was not previously booked
  if (existingLead.status !== 'Booked' && Array.isArray(existingLead.agentIds) && existingLead.agentIds.length > 0) {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMonthStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}`;

    for (const agentId of existingLead.agentIds) {
      try {
        const agentUser = await User.findById(agentId);
        if (agentUser && !agentUser.isAdmin) {
          await ensureCurrentMonthMetrics(agentUser);

          const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
          const currentMonthStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}`;

          const updated = await User.Model.findOneAndUpdate(
            { _id: agentId },
            { $inc: { bookingCount: 1 } },
            { new: true }
          );

          if (updated) {
            let histIdx = (updated.historicalMetrics || []).findIndex(m => m.month === currentMonthStr);
            if (histIdx !== -1) {
              await User.Model.updateOne(
                { _id: agentId, "historicalMetrics.month": currentMonthStr },
                { $set: { "historicalMetrics.$.bookingCount": updated.bookingCount } }
              );
            } else {
              await User.Model.updateOne(
                { _id: agentId },
                {
                  $push: {
                    historicalMetrics: {
                      month: currentMonthStr,
                      monthlyTarget: updated.monthlyTarget || 0,
                      targetCompleted: updated.targetCompleted || 0,
                      bookingCount: updated.bookingCount
                    }
                  }
                }
              );
            }
          }
        }
      } catch (e) {
        console.error("Failed to update agent booking count:", e);
      }
    }
  }

  return formatDoc(result);
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
    return formatDoc(lead);
  }

  // Manage callLogs for the current date in IST (Asia/Kolkata)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (3600000 * 5.5));
  const todayDate = istDate.toISOString().split('T')[0];
  
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
  return formatDoc(result);
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
