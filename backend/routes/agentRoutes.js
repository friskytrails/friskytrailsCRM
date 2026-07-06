const express = require('express');
const agentController = require('../controllers/agentController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, agentController.getAgents);
router.put('/:id/status', auth, agentController.updateAgentStatus);
router.put('/:id/verify', auth, agentController.updateAgentVerification);
router.get('/:id/metrics', auth, agentController.getAgentMetrics);
router.put('/:id/metrics', auth, agentController.updateAgentMetrics);
router.get('/:id/attendance', auth, agentController.getAgentAttendance);

module.exports = router;
