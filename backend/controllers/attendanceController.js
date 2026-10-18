const mongoose = require('mongoose');
const attendanceService = require('../services/attendanceService');

// ─── Error handler ────────────────────────────────────────────────────────────

function handleError(error, res) {
  if (error.name === 'NotFoundError') {
    return res.status(404).json({ error: error.message });
  }
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    const msg = error.name === 'CastError' ? 'Invalid agent ID format' : error.message;
    return res.status(400).json({ error: msg });
  }
  if (error.name === 'ForbiddenError') {
    return res.status(403).json({ error: error.message });
  }
  console.error('Attendance controller error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

// ─── Permission check ─────────────────────────────────────────────────────────

/**
 * Returns true if the caller is allowed to access attendance for :id.
 * Allowed: the agent themselves, any manager, any admin.
 */
function isAllowed(req, id) {
  const { userId, isAdmin, isManager } = req.user;
  return isAdmin || isManager || userId === id;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/agents/:id/attendance/today
 */
async function getTodayAttendance(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    if (!isAllowed(req, id)) {
      return res.status(403).json({ error: 'Forbidden: you can only view your own attendance' });
    }
    const result = await attendanceService.getTodayAttendance(id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

/**
 * PUT /api/agents/:id/attendance/today
 */
async function upsertTodayAttendance(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    if (!isAllowed(req, id)) {
      return res.status(403).json({ error: 'Forbidden: you can only update your own attendance' });
    }
    const { date, status, talkTimeSeconds } = req.body;

    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!status) return res.status(400).json({ error: 'status is required' });

    const result = await attendanceService.upsertTodayAttendance(id, date, status, talkTimeSeconds);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

/**
 * GET /api/agents/:id/attendance/monthly?month=10&year=2026
 */
async function getMonthlyAttendance(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }
    if (!isAllowed(req, id)) {
      return res.status(403).json({ error: 'Forbidden: you can only view your own attendance' });
    }
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required query parameters' });
    }
    const result = await attendanceService.getMonthlyAttendance(id, month, year);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  getTodayAttendance,
  upsertTodayAttendance,
  getMonthlyAttendance
};
