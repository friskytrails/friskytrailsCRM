const express = require('express');
const router = express.Router();
const callService = require('../services/callService');
const auth = require('../middleware/auth');
const crypto = require('crypto');

const sseTickets = new Map();
const sseSubscribers = new Set();
let isUpdatePending = false;

const broadcastSSEUpdate = async () => {
  if (sseSubscribers.size === 0 || isUpdatePending) return;
  isUpdatePending = true;
  
  try {
    const status = await callService.getLiveStatus();
    const activity = await callService.getLiveActivity();
    const payloadStatus = `data: ${JSON.stringify({ type: 'live-status', data: status })}\n\n`;
    const payloadActivity = `data: ${JSON.stringify({ type: 'live-activity', data: activity })}\n\n`;
    
    for (const res of sseSubscribers) {
      res.write(payloadStatus);
      res.write(payloadActivity);
    }
  } catch (error) {
    console.error("Error broadcasting SSE update:", error);
  } finally {
    isUpdatePending = false;
  }
};

callService.callEmitter.on('callLogged', broadcastSSEUpdate);

// POST /api/calls
// Endpoint for the app to log calls
router.post('/', auth, async (req, res) => {
  try {
    const callData = { ...req.body, agentId: req.user.userId };
    const callLog = await callService.logCall(callData);
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
});

// GET /api/calls/live-status
// Main Page Live Status Panel (Legacy Polling)
router.get('/live-status', auth, async (req, res) => {
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
});

// GET /api/calls/live-activity
// Enhanced Live Activity Dashboard
router.get('/live-activity', auth, async (req, res) => {
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
});

// POST /api/calls/stream-ticket
// Generate a short-lived ticket for SSE connection
router.post('/stream-ticket', auth, (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
  const ticket = crypto.randomUUID();
  sseTickets.set(ticket, req.user);
  
  // Ticket expires in 15 seconds
  setTimeout(() => {
    sseTickets.delete(ticket);
  }, 15000);

  res.json({ ticket });
});

// GET /api/calls/stream
// SSE Endpoint for Live Status and Activity
router.get('/stream', async (req, res) => {
  const ticket = req.query.ticket;
  if (!ticket || !sseTickets.has(ticket)) {
    return res.status(401).json({ error: "Invalid or expired SSE ticket" });
  }

  // Authenticate and burn the ticket
  const user = sseTickets.get(ticket);
  sseTickets.delete(ticket);

  if (!user.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }
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

  sseSubscribers.add(res);

  req.on('close', () => {
    sseSubscribers.delete(res);
  });
});

module.exports = router;
