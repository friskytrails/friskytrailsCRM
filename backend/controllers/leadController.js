const leadService = require('../services/leadService');

async function getLeads(req, res) {
  try {
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const leads = await leadService.getLeads(agentIdCondition);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createLead(req, res) {
  try {
    const { name, phone, age, origin, destination, leadSource, mailId, product } = req.body;
    const result = await leadService.createLead(name, phone, age, origin, destination, leadSource, mailId, product, req.user);
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateLead(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, age, origin, destination, leadSource, mailId, product } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.updateLead(id, name, phone, age, origin, destination, leadSource, mailId, product, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function assignLead(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { agentIds } = req.body;
    const result = await leadService.assignLead(id, agentIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function addNote(req, res) {
  try {
    const { id } = req.params;
    const { text, imageUrl } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.addNote(id, text, req.user.userId, imageUrl, agentIdCondition);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteNote(req, res) {
  try {
    const { id, noteId } = req.params;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.deleteNote(id, noteId, req.user.userId, req.user.isAdmin, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Unauthorized to delete this note") {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Note not found" || error.message === "Lead not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
}

async function getLead(req, res) {
  try {
    const { id } = req.params;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const lead = await leadService.getLeadById(id, agentIdCondition);
    res.json(lead);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

async function updateLabels(req, res) {
  try {
    const { id } = req.params;
    const { labels } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.updateLabels(id, labels, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function updateDates(req, res) {
  try {
    const { id } = req.params;
    const { startDate, dueDate } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.updateDates(id, { startDate, dueDate }, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.updateStatus(id, status, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function bookLead(req, res) {
  try {
    const { id } = req.params;
    const { bookingDetails } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.bookLead(id, bookingDetails, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function updateBooking(req, res) {
  try {
    const { id } = req.params;
    const { totalDial, dailyDial, connected, talkTime, dailyTalkTime, firstCall, lastCall } = req.body;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const result = await leadService.updateBooking(id, { totalDial, dailyDial, connected, talkTime, dailyTalkTime, firstCall, lastCall }, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  getLeads,
  createLead,
  updateLead,
  assignLead,
  addNote,
  deleteNote,
  getLead,
  updateLabels,
  updateDates,
  updateStatus,
  bookLead,
  updateBooking
};
