const leadService = require('../services/leadService');
const agentService = require('../services/agentService');

async function getAgentIdCondition(user) {
  if (user.isAdmin || user.isItinerary) {
    return undefined;
  }
  if (user.isManager) {
    const team = await agentService.getMyTeam(user.userId);
    const teamIds = team.map(agent => agent.id || agent._id.toString());
    return [user.userId, ...teamIds];
  }
  return user.userId;
}

function sanitizeLeadForItinerary(leadDoc) {
  if (!leadDoc) return leadDoc;
  const leadObj = typeof leadDoc.toObject === 'function' ? leadDoc.toObject() : { ...leadDoc };
  const leadIdStr = leadObj.id || leadObj._id?.toString() || '';
  return {
    id: leadIdStr,
    _id: leadObj._id,
    leadId: leadObj.leadId,
    name: leadObj.name || 'Unnamed Lead',
    notes: leadObj.notes || [],
    status: leadObj.status || 'Fresh Leads',
    origin: leadObj.origin || '',
    destination: leadObj.destination || '',
    product: leadObj.product || '',
    agentIds: leadObj.agentIds || [],
    createdAt: leadObj.createdAt,
    updatedAt: leadObj.updatedAt,
    // Sensitive fields redacted
    phone: '',
    mailId: '',
    age: null,
    leadSource: '',
    travelDate: '',
    numberOfPersons: null,
    labels: leadObj.labels || [],
    dates: { startDate: null, dueDate: null, reminderDate: null },
    bookingDetails: {},
    booking: {},
    callLogs: [],
    trips: []
  };
}

async function getLeads(req, res) {
  try {
    const agentIdCondition = await getAgentIdCondition(req.user);
    const leads = await leadService.getLeads(agentIdCondition);
    if (req.user.isItinerary) {
      return res.json(leads.map(sanitizeLeadForItinerary));
    }
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createLead(req, res) {
  try {
    if (req.user.isItinerary) {
      return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot create leads" });
    }
    const { name, phone, age, origin, destination, leadSource, mailId, product } = req.body;
    const result = await leadService.createLead(name, phone, age, origin, destination, leadSource, mailId, product, req.user);
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateLead(req, res) {
  try {
    if (req.user.isItinerary) {
      return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot update lead details" });
    }
    const { id } = req.params;
    const { name, phone, age, origin, destination, leadSource, mailId, product, travelDate, numberOfPersons, noOfPax } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
    const numPersons = numberOfPersons !== undefined ? numberOfPersons : noOfPax;
    const result = await leadService.updateLead(id, name, phone, age, origin, destination, leadSource, mailId, product, agentIdCondition, travelDate, numPersons);
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
    const agentIdCondition = await getAgentIdCondition(req.user);
    const result = await leadService.addNote(id, text, req.user.userId, imageUrl, agentIdCondition);
    if (req.user.isItinerary) {
      return res.status(201).json(sanitizeLeadForItinerary(result));
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteNote(req, res) {
  try {
    const { id, noteId } = req.params;
    const agentIdCondition = await getAgentIdCondition(req.user);
    const result = await leadService.deleteNote(id, noteId, req.user.userId, req.user.isAdmin, agentIdCondition);
    if (req.user.isItinerary) {
      return res.json(sanitizeLeadForItinerary(result));
    }
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
    const agentIdCondition = await getAgentIdCondition(req.user);
    const lead = await leadService.getLeadById(id, agentIdCondition);
    if (req.user.isItinerary) {
      return res.json(sanitizeLeadForItinerary(lead));
    }
    res.json(lead);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

async function updateLabels(req, res) {
  try {
    if (req.user.isItinerary) return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot modify lead labels" });
    const { id } = req.params;
    const { labels } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
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
    if (req.user.isItinerary) return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot modify lead dates" });
    const { id } = req.params;
    const { startDate, dueDate } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
    const result = await leadService.updateDates(id, { startDate, dueDate }, agentIdCondition);
    res.json(result);
  } catch (error) {
    if (error.message === "Lead not found or unauthorized") {
      return res.status(403).json({ error: "Forbidden: Not assigned to you" });
    }
    res.status(400).json({ error: error.message });
  }
}

async function updateReminder(req, res) {
  try {
    if (req.user.isItinerary) return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot modify reminders" });
    const { id } = req.params;
    const { reminderDate } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
    const result = await leadService.updateReminder(id, reminderDate, agentIdCondition);
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
    const agentIdCondition = await getAgentIdCondition(req.user);
    const result = await leadService.updateStatus(id, status, agentIdCondition);
    if (req.user.isItinerary) {
      return res.json(sanitizeLeadForItinerary(result));
    }
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
    if (req.user.isItinerary) return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot book leads" });
    const { id } = req.params;
    const { bookingDetails } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
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
    if (req.user.isItinerary) return res.status(403).json({ error: "Forbidden: Itinerary Team members cannot modify booking info" });
    const { id } = req.params;
    const { totalDial, dailyDial, connected, talkTime, dailyTalkTime, firstCall, lastCall } = req.body;
    const agentIdCondition = await getAgentIdCondition(req.user);
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
  updateReminder,
  updateStatus,
  bookLead,
  updateBooking
};

