const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');
const auth = require('../middleware/auth');

// POST /api/calls
// Endpoint for the app to log calls
router.post('/', auth, callController.logCall);

// GET /api/calls/historical
// Historical Performance Report
router.get('/historical', auth, callController.getHistoricalReports);

// GET /api/calls/live-status
// Main Page Live Status Panel (Legacy Polling)
router.get('/live-status', auth, callController.getLiveStatus);

// GET /api/calls/live-activity
// Enhanced Live Activity Dashboard
router.get('/live-activity', auth, callController.getLiveActivity);

module.exports = router;
