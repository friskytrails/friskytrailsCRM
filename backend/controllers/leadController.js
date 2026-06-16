const leadService = require('../services/leadService');

async function getLeads(req, res) {
  try {
    const leads = await leadService.getLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createLead(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { name, phone, age, origin, destination, leadSource, mailId, product } = req.body;
    const result = await leadService.createLead(name, phone, age, origin, destination, leadSource, mailId, product);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateLead(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { name, phone, age, origin, destination, leadSource, mailId, product } = req.body;
    const result = await leadService.updateLead(id, name, phone, age, origin, destination, leadSource, mailId, product);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function assignLead(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { agentId } = req.body;
    const result = await leadService.assignLead(id, agentId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function addNote(req, res) {
  try {
    const { id } = req.params;
    const { text, imageUrl } = req.body;
    const result = await leadService.addNote(id, text, req.user.userId, imageUrl);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteNote(req, res) {
  try {
    const { id, noteId } = req.params;
    const result = await leadService.deleteNote(id, noteId, req.user.userId, req.user.isAdmin);
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
    const lead = await leadService.getLeadById(id);
    res.json(lead);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

async function updateLabels(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { labels } = req.body;
    const result = await leadService.updateLabels(id, labels);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateDates(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { startDate, dueDate } = req.body;
    const result = await leadService.updateDates(id, { startDate, dueDate });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await leadService.updateStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateBooking(req, res) {
  try {
    const { id } = req.params;
    const { totalDial, connected, talkTime, firstCall, lastCall } = req.body;
    const result = await leadService.updateBooking(id, { totalDial, connected, talkTime, firstCall, lastCall });
    res.json(result);
  } catch (error) {
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
  updateBooking
};
