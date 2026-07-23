const agentService = require('../services/agentService');

function handleAgentServiceError(error, res) {
  if (error.name === "NotFoundError") {
    return res.status(404).json({ error: error.message });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    const message = error.name === "CastError" ? "Invalid agent ID format" : error.message;
    return res.status(400).json({ error: message });
  }
  console.error("Agent service error:", error);
  return res.status(500).json({ error: "Internal server error" });
}

async function getAgents(req, res) {
  try {
    const agents = await agentService.getAgents();
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


async function updateAgentStatus(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { status } = req.body;
    const agent = await agentService.updateAgentStatus(id, status);
    res.json(agent);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

async function updateAgentVerification(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { isVerified } = req.body;
    const agent = await agentService.updateAgentVerification(id, isVerified);
    res.json(agent);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

async function updateAgentMetrics(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { monthlyTarget, targetCompleted, attendance, attendanceDate, date, bookingCount } = req.body;
    const finalDate = date || attendanceDate;
    const agent = await agentService.updateAgentMetrics(id, monthlyTarget, targetCompleted, attendance, finalDate, bookingCount);
    res.json(agent);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

async function getAgentAttendance(req, res) {
  try {
    const { id } = req.params;
    if (!req.user.isAdmin && req.user.userId !== id) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const logs = await agentService.getAgentAttendance(id);
    res.json(logs);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

async function getAgentMetrics(req, res) {
  try {
    const { id } = req.params;
    if (!req.user.isAdmin && req.user.userId !== id) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const metrics = await agentService.getAgentMetrics(id);
    res.json(metrics);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

async function getAgentMonthlyAttendance(req, res) {
  try {
    const { id } = req.params;
    if (!req.user.isAdmin && req.user.userId !== id) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required query parameters" });
    }
    
    const summary = await agentService.getAgentMonthlyAttendance(id, month, year);
    res.json(summary);
  } catch (error) {
    return handleAgentServiceError(error, res);
  }
}

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification,
  getAgentMetrics,
  updateAgentMetrics,
  getAgentAttendance,
  getAgentMonthlyAttendance
};
