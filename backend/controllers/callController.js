const callService = require('../services/callService');

// @desc    Log a call from the app / CRM
// @route   POST /api/calls
// @access  Private
const logCall = async (req, res) => {
  try {
    const { status, leadId, duration, timestamp, contactNumber, clientCallId } = req.body;
    const agentId = req.user.userId || req.user.id;

    if (!agentId || !status) {
      return res.status(400).json({ error: "agentId and status are required" });
    }

    const callLog = await callService.logCall({ 
      agentId,
      leadId: leadId || undefined,
      duration,
      timestamp,
      status,
      contactNumber,
      clientCallId
    });
    
    res.status(201).json(callLog);
  } catch (error) {
    console.error("Error saving call log:", error);
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to log call" });
  }
};

// @desc    Get historical performance report
// @route   GET /api/calls/historical
// @access  Private (Admin only / Agent restricted)
const getHistoricalReports = async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ error: "Access denied" });
  }
  if (!req.user.isAdmin && !req.user.userId) {
    return res.status(403).json({ error: "User ID missing for non-admin request" });
  }
  try {
    const { startDate, endDate, team } = req.query;
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const reports = await callService.getHistoricalReports(startDate, endDate, team, agentIdCondition);
    res.json(reports);
  } catch (error) {
    console.error("Error generating historical report:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get live status for admin dashboard panel
// @route   GET /api/calls/live-status
// @access  Private (Admin only)
const getLiveStatus = async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ error: "Access denied" });
  }
  if (!req.user.isAdmin && !req.user.userId) {
    return res.status(403).json({ error: "User ID missing for non-admin request" });
  }
  try {
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const liveStatus = await callService.getLiveStatus(agentIdCondition);
    res.json(liveStatus);
  } catch (error) {
    console.error("Error generating live status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get live activity for admin dashboard panel
// @route   GET /api/calls/live-activity
// @access  Private (Admin only)
const getLiveActivity = async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ error: "Access denied" });
  }
  if (!req.user.isAdmin && !req.user.userId) {
    return res.status(403).json({ error: "User ID missing for non-admin request" });
  }
  try {
    const agentIdCondition = req.user.isAdmin ? undefined : req.user.userId;
    const activity = await callService.getLiveActivity(agentIdCondition);
    res.json(activity);
  } catch (error) {
    console.error("Error generating live activity:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// @desc    Get detailed long calls breakdown for an agent
// @route   GET /api/calls/long-calls
// @access  Private
const getLongCallsDetails = async (req, res) => {
  if (!req.user) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const { agentId, startDate, endDate, metric } = req.query;
    const targetAgentId = req.user.isAdmin ? agentId : req.user.userId;
    const details = await callService.getLongCallsDetails(targetAgentId, startDate, endDate, metric);
    res.json(details);
  } catch (error) {
    console.error("Error fetching long call details:", error);
    res.status(500).json({ error: "Server error fetching long calls" });
  }
};

module.exports = {
  logCall,
  getHistoricalReports,
  getLiveStatus,
  getLiveActivity,
  getLongCallsDetails
};
