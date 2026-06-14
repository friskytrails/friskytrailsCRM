const Lead = require('../models/Lead');
const User = require('../models/User');
const { formatDoc } = require('../utils/helpers');
const mongoose = require('mongoose');

async function getLeads() {
  const leads = await Lead.findAll();
  return leads.map(formatDoc);
}

async function createLead(name, phone, age, origin, destination, leadSource, mailId) {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error("Phone number must be exactly 10 digits with no spaces");
  }

  const lead = {
    name: name || '',
    phone: cleanPhone,
    age: age ? Number(age) : undefined,
    origin: origin || '',
    destination: destination || '',
    leadSource: leadSource || '',
    mailId: mailId || '',
    agentId: null,
    notes: []
  };

  const result = await Lead.insertLead(lead);
  const newLead = await Lead.findById(result.insertedId);
  return formatDoc(newLead);
}

async function updateLead(id, name, phone, age, origin, destination, leadSource, mailId) {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error("Phone number must be exactly 10 digits with no spaces");
  }

  const result = await Lead.updateLead(id, {
    name: name || '',
    phone: cleanPhone,
    age: age ? Number(age) : undefined,
    origin: origin || '',
    destination: destination || '',
    leadSource: leadSource || '',
    mailId: mailId || ''
  });

  if (!result) {
    throw new Error("Lead not found");
  }

  return formatDoc(result);
}

async function assignLead(id, agentId) {
  const updateVal = agentId ? agentId : null;
  const result = await Lead.updateLead(id, { agentId: updateVal });

  if (!result) {
    throw new Error("Lead not found");
  }

  return formatDoc(result);
}

async function addNote(id, text, userId, imageUrl) {
  if ((!text || !text.trim()) && !imageUrl) {
    throw new Error("Note text or image is required");
  }

  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
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

  const result = await Lead.pushNote(id, newNote);
  return formatDoc(result);
}

async function deleteNote(id, noteId, userId, isAdmin) {
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }

  const note = lead.notes.find(n => n.id === noteId || (n._id && n._id.toString() === noteId));
  if (!note) {
    throw new Error("Note not found");
  }

  if (!isAdmin && (!note.authorId || note.authorId !== userId)) {
    throw new Error("Unauthorized to delete this note");
  }

  const result = await Lead.deleteNote(id, noteId);
  return formatDoc(result);
}

async function getLeadById(id) {
  const lead = await Lead.findById(id);
  if (!lead) {
    throw new Error("Lead not found");
  }
  return formatDoc(lead);
}

async function updateLabels(id, labels) {
  const result = await Lead.updateLead(id, { labels: labels || [] });
  if (!result) {
    throw new Error("Lead not found");
  }
  return formatDoc(result);
}

async function updateDates(id, dates) {
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
  const result = await Lead.updateLead(id, updateData);
  if (!result) {
    throw new Error("Lead not found");
  }
  return formatDoc(result);
}

async function updateStatus(id, status) {
  const validStatuses = ['New', 'Contacted', 'Follow Up', 'Interested', 'Booked', 'Rejected', 'Closed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }
  const result = await Lead.updateLead(id, { status });
  if (!result) {
    throw new Error("Lead not found");
  }
  return formatDoc(result);
}

async function updateBooking(id, bookingData) {
  const updateFields = {};
  if (bookingData.totalDial !== undefined) {
    updateFields['booking.totalDial'] = Number(bookingData.totalDial) || 0;
  }
  if (bookingData.connected !== undefined) {
    updateFields['booking.connected'] = Number(bookingData.connected) || 0;
  }
  if (bookingData.talkTime !== undefined) {
    updateFields['booking.talkTime'] = bookingData.talkTime || '0:0';
  }
  if (bookingData.firstCall !== undefined) {
    if (bookingData.firstCall) {
      const d = new Date(bookingData.firstCall);
      if (isNaN(d.getTime())) throw new Error("Invalid firstCall date");
      updateFields['booking.firstCall'] = d;
    } else {
      updateFields['booking.firstCall'] = null;
    }
  }
  if (bookingData.lastCall !== undefined) {
    if (bookingData.lastCall) {
      const d = new Date(bookingData.lastCall);
      if (isNaN(d.getTime())) throw new Error("Invalid lastCall date");
      updateFields['booking.lastCall'] = d;
    } else {
      updateFields['booking.lastCall'] = null;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    throw new Error("No booking fields provided to update");
  }

  const result = await Lead.updateLead(id, updateFields);
  if (!result) {
    throw new Error("Lead not found");
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
  updateStatus,
  updateBooking
};
