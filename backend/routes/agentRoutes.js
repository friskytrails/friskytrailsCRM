const express = require('express');
const agentController = require('../controllers/agentController');
const attendanceController = require('../controllers/attendanceController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/my-team', auth, agentController.getMyTeam);
router.get('/', auth, agentController.getAgents);
router.put('/:id/status', auth, agentController.updateAgentStatus);
router.put('/:id/verify', auth, agentController.updateAgentVerification);
router.get('/:id/metrics', auth, agentController.getAgentMetrics);
router.put('/:id/metrics', auth, agentController.updateAgentMetrics);
// Attendance routes — specific paths must be declared before the generic /:id/attendance
router.get('/:id/attendance/today', auth, attendanceController.getTodayAttendance);
router.put('/:id/attendance/today', auth, attendanceController.upsertTodayAttendance);
router.get('/:id/attendance/monthly', auth, attendanceController.getMonthlyAttendance);
router.get('/:id/attendance', auth, agentController.getAgentAttendance);
router.put('/:id/toggle-manager', auth, agentController.toggleManagerRole);
router.put('/:id/toggle-itinerary', auth, agentController.toggleItineraryRole);
router.put('/:id/assign-agents', auth, agentController.assignAgentsToManager);

module.exports = router;
