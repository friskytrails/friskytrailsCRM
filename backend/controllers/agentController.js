const agentService = require('../services/agentService');

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
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
  }
}

async function updateAgentMetrics(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const { monthlyTarget, targetCompleted, attendance, attendanceDate } = req.body;
    const agent = await agentService.updateAgentMetrics(id, monthlyTarget, targetCompleted, attendance, attendanceDate);
    res.json(agent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function getAgentAttendance(req, res) {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden: Admin access only" });
    }
    const { id } = req.params;
    const logs = await agentService.getAgentAttendance(id);
    res.json(logs);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    res.status(400).json({ error: error.message });
  }
}

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification,
  getAgentMetrics,
  updateAgentMetrics,
  getAgentAttendance
};
