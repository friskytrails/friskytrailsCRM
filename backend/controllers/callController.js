const callService = require('../services/callService');

// @desc    Log a call from the mobile app
// @route   POST /api/calls
// @access  Private
const logCall = async (req, res) => {
  try {
    const { status } = req.body;
    const agentId = req.user.userId;

    if (!agentId || !status) {
      return res.status(400).json({ error: "agentId and status are required" });
    }

    const callLog = await callService.logCall({ ...req.body, agentId });
    res.status(201).json(callLog);
  } catch (error) {
    console.error("Error saving call log:", error);
    // Now any error caught here is a true 500 Server Error
    res.status(500).json({ error: "Server error" });
  }
};


// @desc    Get historical performance report
// @route   GET /api/calls/historical
// @access  Private (Admin only)
const getHistoricalReports = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const { startDate, endDate, team } = req.query;
    const reports = await callService.getHistoricalReports(startDate, endDate, team);
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
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const liveStatus = await callService.getLiveStatus();
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
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const activity = await callService.getLiveActivity();
    res.json(activity);
  } catch (error) {
    console.error("Error generating live activity:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  logCall,
  getHistoricalReports,
  getLiveStatus,
  getLiveActivity
};
