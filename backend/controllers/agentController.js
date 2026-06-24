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

module.exports = {
  getAgents,
  updateAgentStatus,
  updateAgentVerification
};
