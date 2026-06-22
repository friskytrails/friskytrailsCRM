const express = require('express');
const agentController = require('../controllers/agentController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, agentController.getAgents);
router.put('/:id/status', auth, agentController.updateAgentStatus);

module.exports = router;
