 const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getAgentIdCondition } = require('../services/agentService');

// Generate unique bookingId: "FT" + 6 random uppercase chars
async function generateBookingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let bookingId = '';
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    attempts++;
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    bookingId = 'FT' + code;
    const found = await Booking.findOne({ bookingId });
    if (!found) exists = false;
  }
  if (exists) {
    throw new Error('Failed to generate a unique bookingId');
  }
  return bookingId;
}

// Generate unique paymentId: 6 random digits
async function generatePaymentId() {
  let paymentId = '';
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    attempts++;
    paymentId = crypto.randomInt(100000, 1000000).toString();
    const found = await Booking.findOne({ 'payments.paymentId': paymentId });
    if (!found) exists = false;
  }
  if (exists) {
    throw new Error('Failed to generate a unique paymentId');
  }
  return paymentId;
}

/**
 * POST /api/bookings
 * Create new booking
 */
async function createBooking(req, res) {
  try {
    const {
      travellerName,
      travellerEmail,
      travellerPhone,
      adults,
      children,
      packageName,
      location,
      startDate,
      endDate,
      totalAmount,
      paidAmount,
      transactionId,
      paymentMode,
      leadId
    } = req.body;

    // 1. Field Validations
    if (!travellerName || !travellerName.trim()) {
      return res.status(400).json({ success: false, error: 'Full Name is required.' });
    }

    if (!travellerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(travellerEmail.trim())) {
      return res.status(400).json({ success: false, error: 'Valid Email ID is required.' });
    }

    const trimmedPhone = (travellerPhone || '').toString().trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      return res.status(400).json({ success: false, error: 'Phone Number must be exactly 10 digits starting with 6, 7, 8, or 9.' });
    }

    const numAdults = parseInt(adults, 10);
    const numChildren = parseInt(children, 10);
    if (isNaN(numAdults) || numAdults < 0) {
      return res.status(400).json({ success: false, error: 'Adults count must be a non-negative integer.' });
    }
    if (isNaN(numChildren) || numChildren < 0) {
      return res.status(400).json({ success: false, error: 'Children count must be a non-negative integer.' });
    }

    if (!packageName || !packageName.trim()) {
      return res.status(400).json({ success: false, error: 'Package Name is required.' });
    }

    if (!location || !location.trim()) {
      return res.status(400).json({ success: false, error: 'Destination Location is required.' });
    }

    if (!startDate || isNaN(Date.parse(startDate))) {
      return res.status(400).json({ success: false, error: 'Valid Start Date is required.' });
    }

    if (!endDate || isNaN(Date.parse(endDate))) {
      return res.status(400).json({ success: false, error: 'Valid End Date is required.' });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, error: 'End Date cannot be earlier than Start Date.' });
    }

    const numTotal = parseFloat(totalAmount);
    const numPaid = parseFloat(paidAmount);
    if (isNaN(numTotal) || numTotal < 0) {
      return res.status(400).json({ success: false, error: 'Total Amount must be a non-negative number.' });
    }
    if (isNaN(numPaid) || numPaid < 0) {
      return res.status(400).json({ success: false, error: 'Paid Amount must be a non-negative number.' });
    }
    if (numPaid > numTotal) {
      return res.status(400).json({ success: false, error: 'Paid Amount cannot exceed Total Amount.' });
    }

    const trimmedTxn = (transactionId || '').trim();
    if (!trimmedTxn || !/^[a-zA-Z0-9_-]+$/.test(trimmedTxn)) {
      return res.status(400).json({ success: false, error: 'Transaction ID is required and can only contain letters, numbers, underscore, and hyphen.' });
    }

    // Check unique transactionId
    const existingTxn = await Booking.findOne({
      $or: [
        { transactionId: trimmedTxn },
        { 'payments.details': trimmedTxn }
      ]
    });
    if (existingTxn) {
      return res.status(400).json({ success: false, error: 'Transaction ID must be unique across all bookings.' });
    }

    // Check screenshot file
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Transaction screenshot file is mandatory.' });
    }
    const screenshotUrl = req.file.secure_url || req.file.path || '';

    // Validate leadId and lead authorization if provided
    let targetLead = null;
    if (leadId) {
      const strLeadId = leadId.toString();
      targetLead = await Lead.findById(strLeadId);
      if (!targetLead) {
        return res.status(400).json({ success: false, error: 'Target lead not found.' });
      }

      // Authorization check using agentIdCondition
      const agentIdCondition = await getAgentIdCondition(req.user);
      if (agentIdCondition !== undefined) {
        const isAuthorized = Array.isArray(agentIdCondition)
          ? (targetLead.agentIds || []).some(id => agentIdCondition.includes(id))
          : (targetLead.agentIds || []).includes(agentIdCondition);
        if (!isAuthorized) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to mark this lead as Booked.' });
        }
      }
    }

    // 2. Generate IDs and create ledger entry
    const bookingId = await generateBookingId();
    const paymentId = await generatePaymentId();
    const calculatedDue = Math.max(0, numTotal - numPaid);

    const initialPayment = {
      paymentId: paymentId,
      paymentDate: new Date(),
      paymentFrom: 'TRAVELER',
      paymentTo: 'COMPANY',
      amountPaid: numPaid,
      paymentMode: paymentMode || 'Kalpana BOI',
      status: 'VERIFICATION-REQUIRED',
      addedBy: req.user.name || req.user.email || 'Agent',
      attachment: screenshotUrl,
      attachmentName: 'Screenshot',
      details: trimmedTxn,
      verified: false
    };

    const newBooking = new Booking({
      bookingId,
      leadId,
      paymentId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      packageName: packageName.trim(),
      location: location.trim(),
      totalAmount: numTotal,
      paidAmount: numPaid,
      dueAmount: calculatedDue,
      transactionId: trimmedTxn,
      screenshot: screenshotUrl,
      travellerName: travellerName.trim(),
      travellerEmail: travellerEmail.trim().toLowerCase(),
      travellerPhone: trimmedPhone,
      createdBy: req.user.userId || req.user.id || req.user._id,
      status: 'Pending',
      tripStatus: 'Pending',
      assignedTo: req.user.userId ? [req.user.userId] : [],
      adults: numAdults,
      children: numChildren,
      payments: [initialPayment]
    });

    try {
      await newBooking.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        const isTxn = (saveError.keyPattern && saveError.keyPattern.transactionId) || (saveError.errmsg && saveError.errmsg.includes('transactionId')) || (saveError.message && saveError.message.includes('transactionId'));
        const isBkg = (saveError.keyPattern && saveError.keyPattern.bookingId) || (saveError.errmsg && saveError.errmsg.includes('bookingId')) || (saveError.message && saveError.message.includes('bookingId'));
        const isPay = (saveError.keyPattern && saveError.keyPattern.paymentId) || (saveError.errmsg && saveError.errmsg.includes('paymentId')) || (saveError.message && saveError.message.includes('paymentId'));

        if (isTxn) {
          return res.status(400).json({ success: false, error: 'Transaction ID must be unique across all bookings.' });
        }
        if (isBkg) {
          return res.status(400).json({ success: false, error: 'Booking ID must be unique.' });
        }
        if (isPay) {
          return res.status(400).json({ success: false, error: 'Payment ID must be unique.' });
        }
        return res.status(400).json({ success: false, error: 'A booking with this unique key already exists.' });
      }
      throw saveError;
    }

    // 3. Update corresponding CRM Lead status if targetLead was validated
    let leadSyncStatus = 'Not Attempted';
    if (targetLead) {
      try {
        targetLead.status = 'Booked';
        await targetLead.save();
        leadSyncStatus = 'Success';
      } catch (leadErr) {
        console.error('Failed to sync CRM lead status:', leadErr);
        leadSyncStatus = 'Failed: Error syncing lead';
      }
    }

    res.status(201).json({
      success: true,
      data: newBooking,
      leadSyncStatus: leadId ? leadSyncStatus : undefined
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/bookings/:id
 * Load existing booking for view/edit
 */
async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const { packageName } = req.query;
    let booking = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      booking = await Booking.findById(id);
    }
    if (!booking) {
      booking = await Booking.findOne({ bookingId: id });
    }
    if (!booking) {
      booking = await Booking.findOne({ transactionId: id });
    }
    if (!booking) {
      const query = { travellerPhone: id };
      
      // Filter by packageName if provided to prevent overwriting trip details with the wrong booking
      if (packageName) {
        query.packageName = packageName;
      }
      
      booking = await Booking.findOne(query);
    }

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    if (req.user) {
      const userIdStr = (req.user.userId || req.user.id || req.user._id).toString();
      const isCreator = booking.createdBy && booking.createdBy.toString() === userIdStr;
      const isAssigned = Array.isArray(booking.assignedTo) && booking.assignedTo.some(a => a.toString() === userIdStr);
      const isAdmin = !!req.user.isAdmin;

      if (!isAdmin && !isCreator && !isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view this booking.' });
      }
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

/**
 * PUT /api/bookings/:id/edit
 * Edit booking fields
 */
async function editBooking(req, res) {
  try {
    const { id } = req.params;
    let booking = id.match(/^[0-9a-fA-F]{24}$/) 
      ? await Booking.findById(id) 
      : await Booking.findOne({ bookingId: id });

    if (!booking) {
      booking = await Booking.findOne({ transactionId: id });
    }

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    // Role check: Admin, creator, or assigned employee can edit
    const userIdStr = (req.user.userId || req.user.id || req.user._id).toString();
    const isCreator = booking.createdBy && booking.createdBy.toString() === userIdStr;
    const isAssigned = Array.isArray(booking.assignedTo) && booking.assignedTo.some(a => a.toString() === userIdStr);
    const isAdmin = !!req.user.isAdmin;

    if (!isAdmin && !isCreator && !isAssigned) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to edit this booking.' });
    }

    const updates = req.body;

    // Apply updates
    if (updates.travellerName) booking.travellerName = updates.travellerName.trim();
    if (updates.travellerEmail) booking.travellerEmail = updates.travellerEmail.trim().toLowerCase();
    if (updates.travellerPhone) booking.travellerPhone = updates.travellerPhone.trim();
    if (updates.packageName) booking.packageName = updates.packageName.trim();
    if (updates.location) booking.location = updates.location.trim();
    if (updates.startDate) {
      if (isNaN(Date.parse(updates.startDate))) {
        return res.status(400).json({ success: false, error: 'Invalid Start Date.' });
      }
      booking.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      if (isNaN(Date.parse(updates.endDate))) {
        return res.status(400).json({ success: false, error: 'Invalid End Date.' });
      }
      booking.endDate = new Date(updates.endDate);
    }
    if (booking.endDate < booking.startDate) {
      return res.status(400).json({ success: false, error: 'End Date cannot be earlier than Start Date.' });
    }
    if (updates.totalAmount !== undefined) booking.totalAmount = parseFloat(updates.totalAmount);
    if (updates.paidAmount !== undefined) {
      const newPaid = parseFloat(updates.paidAmount);
      booking.paidAmount = newPaid;
    }
    if (updates.totalAmount !== undefined || updates.paidAmount !== undefined) {
      booking.dueAmount = Math.max(0, (booking.totalAmount || 0) - (booking.paidAmount || 0));
    }
    if (updates.adults !== undefined) booking.adults = parseInt(updates.adults, 10);
    if (updates.children !== undefined) booking.children = parseInt(updates.children, 10);
    if (updates.status) booking.status = updates.status;
    if (updates.tripStatus) booking.tripStatus = updates.tripStatus;
    if (updates.transactionId) booking.transactionId = updates.transactionId.trim();

    // Optional replacement screenshot upload
    if (req.file) {
      booking.screenshot = req.file.secure_url || req.file.path;
    }

    try {
      await booking.save();
    } catch (saveError) {
      if (saveError.code === 11000) {
        const isTxn = (saveError.keyPattern && saveError.keyPattern.transactionId) || (saveError.errmsg && saveError.errmsg.includes('transactionId')) || (saveError.message && saveError.message.includes('transactionId'));
        const isBkg = (saveError.keyPattern && saveError.keyPattern.bookingId) || (saveError.errmsg && saveError.errmsg.includes('bookingId')) || (saveError.message && saveError.message.includes('bookingId'));
        const isPay = (saveError.keyPattern && saveError.keyPattern.paymentId) || (saveError.errmsg && saveError.errmsg.includes('paymentId')) || (saveError.message && saveError.message.includes('paymentId'));

        if (isTxn) {
          return res.status(400).json({ success: false, error: 'Transaction ID must be unique across all bookings.' });
        }
        if (isBkg) {
          return res.status(400).json({ success: false, error: 'Booking ID must be unique.' });
        }
        if (isPay) {
          return res.status(400).json({ success: false, error: 'Payment ID must be unique.' });
        }
        return res.status(400).json({ success: false, error: 'A booking with this unique key already exists.' });
      }
      throw saveError;
    }

    return res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error editing booking:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

module.exports = {
  createBooking,
  getBookingById,
  editBooking,
  generateBookingId,
  generatePaymentId
};
