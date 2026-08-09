const express = require('express');
const authRoutes = require('./authRoutes');
const leadRoutes = require('./leadRoutes');
const agentRoutes = require('./agentRoutes');
const uploadRoutes = require('./uploadRoutes');
const cronRoutes = require('./cronRoutes');
const callRoutes = require('./callRoutes');
const configRoutes = require('./configRoutes');
const bugReportRoutes = require('./bugReportRoutes');
const bookingRoutes = require('./bookingRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/agents', agentRoutes);
router.use('/upload', uploadRoutes);
router.use('/cron', cronRoutes);
router.use('/calls', callRoutes);
router.use('/config', configRoutes);
router.use('/bugs', bugReportRoutes);
router.use('/bookings', bookingRoutes);

module.exports = router;
