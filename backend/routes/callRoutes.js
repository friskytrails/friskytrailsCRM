const express = require('express');
const router = express.Router();
const callService = require('../services/callService');
const auth = require('../middleware/auth');

// POST /api/calls
// Endpoint for the app to log calls
router.post('/', async (req, res) => {
  try {
    const callLog = await callService.logCall(req.body);
    res.status(201).json(callLog);
  } catch (error) {
    console.error("Error saving call log:", error);
    if (error.message === 'agentId and status are required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/calls/historical
// Historical Performance Report
router.get('/historical', auth, async (req, res) => {
  try {
    const { startDate, endDate, team } = req.query;
    const reports = await callService.getHistoricalReports(startDate, endDate, team);
    res.json(reports);
  } catch (error) {
    console.error("Error generating historical report:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/calls/live-status
// Main Page Live Status Panel (Legacy Polling)
router.get('/live-status', auth, async (req, res) => {
  try {
    const liveStatus = await callService.getLiveStatus();
    res.json(liveStatus);
  } catch (error) {
    console.error("Error generating live status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/calls/live-activity
// Enhanced Live Activity Dashboard
router.get('/live-activity', auth, async (req, res) => {
  try {
    const activity = await callService.getLiveActivity();
    res.json(activity);
  } catch (error) {
    console.error("Error generating live activity:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/calls/stream
// SSE Endpoint for Live Status and Activity
router.get('/stream', auth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial data
  try {
    const status = await callService.getLiveStatus();
    res.write(`data: ${JSON.stringify({ type: 'live-status', data: status })}\n\n`);
    const activity = await callService.getLiveActivity();
    res.write(`data: ${JSON.stringify({ type: 'live-activity', data: activity })}\n\n`);
  } catch (error) {
    console.error("Error sending initial SSE data:", error);
  }

  const onCallUpdate = async () => {
    try {
      const status = await callService.getLiveStatus();
      res.write(`data: ${JSON.stringify({ type: 'live-status', data: status })}\n\n`);
      const activity = await callService.getLiveActivity();
      res.write(`data: ${JSON.stringify({ type: 'live-activity', data: activity })}\n\n`);
    } catch (error) {
      console.error("Error sending SSE update:", error);
    }
  };

  callService.callEmitter.on('callLogged', onCallUpdate);

  req.on('close', () => {
    callService.callEmitter.off('callLogged', onCallUpdate);
  });
});

module.exports = router;
