'use strict';

const Attendance = require('../models/Attendance');
const User = require('../models/User');

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEK_OFF_DAYS = [0]; // 0 = Sunday (JS getDay())

const STATUS_RANK = { A: 0, H: 1, P: 2 };

const RULES = {
  halfDayMinSeconds: 3600,   // 60 min
  fullDayMinSeconds: 6000,   // ~100 min
  weekOffDays: WEEK_OFF_DAYS
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date string in IST as "YYYY-MM-DD".
 */
function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Returns yesterday's date string in IST as "YYYY-MM-DD".
 */
function getYesterdayIST() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Returns a "YYYY-MM-DD" string's weekday number (0=Sun … 6=Sat)
 * in IST-aware fashion.
 */
function getWeekdayOfDate(dateStr) {
  // Append IST midnight so JS doesn't shift the day in UTC-offset zones
  return new Date(dateStr + 'T00:00:00+05:30').getDay();
}

/**
 * Returns the full English weekday name for a date string.
 */
function getWeekdayName(dateStr) {
  return new Date(dateStr + 'T00:00:00+05:30')
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
}

/**
 * Returns true if the given IST date string falls on a week-off day (Sunday).
 */
function isWeekOff(dateStr) {
  return WEEK_OFF_DAYS.includes(getWeekdayOfDate(dateStr));
}

/**
 * Creates a standardised service error.
 * @param {string} message
 * @param {'ValidationError'|'NotFoundError'|'ForbiddenError'} [name]
 */
function createError(message, name = 'ValidationError') {
  const err = new Error(message);
  err.name = name;
  return err;
}

// ─── Guard helpers ────────────────────────────────────────────────────────────

/**
 * Resolves the User document for :id, throwing:
 *   - CastError  → invalid ObjectId format
 *   - NotFoundError → user not found OR is an admin (admins have no attendance)
 */
async function resolveAgent(id) {
  let user;
  try {
    user = await User.findById(id);
  } catch (e) {
    if (e.name === 'CastError') throw createError('Invalid agent ID format', 'CastError');
    throw e;
  }
  if (!user) throw createError('Agent not found', 'NotFoundError');
  if (user.isAdmin) throw createError('Admins do not have attendance records', 'NotFoundError');
  return user;
}

// ─── Monthly summary ──────────────────────────────────────────────────────────

/**
 * Computes the monthly attendance totals for an agent.
 *
 * Rules (per spec §6):
 *   - Only *finished* days are counted: 1st → yesterday for the current month;
 *     full month for past months.
 *   - A weekday with no record counts as Absent.
 *   - Sunday always counts as WeekOff (even if a record exists).
 *
 * @param {string|ObjectId} agentId
 * @param {number} month  1-12
 * @param {number} year   e.g. 2026
 * @returns {{ month: string, fullDay: number, halfDay: number, absent: number, weekOff: number, present: number }}
 */
async function computeMonthlySummary(agentId, month, year) {
  const todayIST = getTodayIST();
  const [todayYear, todayMonth] = todayIST.split('-').map(Number);

  const isCurrentMonth = year === todayYear && month === todayMonth;

  // Build inclusive date range strings
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;

  let endDateStr;
  if (isCurrentMonth) {
    // Exclude today — use yesterday
    endDateStr = getYesterdayIST();
  } else {
    // Last day of that past month
    const lastDay = new Date(year, month, 0).getDate(); // month is 1-based; Date(y, m, 0) = last day of month m-1
    endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // Enumerate all days in the range
  const days = [];
  const cursor = new Date(startDateStr + 'T00:00:00+05:30');
  const end = new Date(endDateStr + 'T00:00:00+05:30');

  while (cursor <= end) {
    days.push(cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Load all records for this agent in the range
  const records = await Attendance.find({
    agentId,
    date: { $gte: startDateStr, $lte: endDateStr }
  }).lean();

  const recordMap = new Map(records.map(r => [r.date, r.status]));

  let fullDay = 0, halfDay = 0, absent = 0, weekOff = 0;

  for (const day of days) {
    if (service.isWeekOff(day)) {
      weekOff++;
    } else {
      const status = recordMap.get(day) || 'A';
      if (status === 'P') fullDay++;
      else if (status === 'H') halfDay++;
      else absent++; // A, WO-on-a-weekday (shouldn't happen), or missing
    }
  }

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    fullDay,
    halfDay,
    absent,
    weekOff,
    present: fullDay  // backward-compat alias
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * GET /api/agents/:id/attendance/today
 *
 * Returns today's attendance for an agent, synthesising a default if no record
 * exists yet, and always including the business rules the app needs.
 */
async function getTodayAttendance(id) {
  await resolveAgent(id);

  const today = service.getTodayIST();
  const weekOff = service.isWeekOff(today);
  const record = await Attendance.findOne({ agentId: id, date: today }).lean();

  const status = record ? record.status : (weekOff ? 'WO' : 'A');
  const talkTimeSeconds = record ? (record.talkTimeSeconds || 0) : 0;

  return {
    date: today,
    weekday: getWeekdayName(today),
    status,
    talkTimeSeconds,
    isWeekOff: weekOff,
    rules: RULES
  };
}

/**
 * PUT /api/agents/:id/attendance/today
 *
 * Idempotent status-rise upsert.  Only moves the status *up* the rank chain
 * (A → H → P).  Returns the current state plus a fresh monthly summary.
 *
 * @param {string} id          Agent ObjectId
 * @param {string} date        "YYYY-MM-DD" (must be today in IST)
 * @param {string} status      "A" | "H" | "P"  (WO is rejected)
 * @param {number} [talkTimeSeconds]
 */
async function upsertTodayAttendance(id, date, status, talkTimeSeconds) {
  // ── Validate date ──────────────────────────────────────────────────────────
  const today = service.getTodayIST();
  if (date !== today) {
    throw createError(`date must be today in IST (${today})`, 'ValidationError');
  }

  // ── Validate status ────────────────────────────────────────────────────────
  const allowedStatuses = ['A', 'H', 'P'];
  if (!allowedStatuses.includes(status)) {
    throw createError(`status must be one of A, H, P. Received: "${status}"`, 'ValidationError');
  }

  // ── Resolve agent (also rejects admins) ───────────────────────────────────
  await resolveAgent(id);

  // ── Week-off short-circuit ─────────────────────────────────────────────────
  if (service.isWeekOff(today)) {
    const [yyyy, mm] = today.split('-').map(Number);
    const monthSummary = await service.computeMonthlySummary(id, mm, yyyy);
    return {
      date: today,
      status: 'WO',
      talkTimeSeconds: talkTimeSeconds || 0,
      monthSummary
    };
  }

  // ── Load current record ────────────────────────────────────────────────────
  const existing = await Attendance.findOne({ agentId: id, date: today }).lean();
  const storedStatus = existing ? existing.status : 'A';
  const storedRank = STATUS_RANK[storedStatus] ?? 0;
  const incomingRank = STATUS_RANK[status];

  let finalRecord;

  if (incomingRank > storedRank) {
    // Upsert — move the status up
    finalRecord = await Attendance.findOneAndUpdate(
      { agentId: id, date: today },
      { $set: { status, talkTimeSeconds: talkTimeSeconds ?? 0 } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();
  } else {
    // Idempotent — return stored value unchanged
    finalRecord = existing || { status: 'A', talkTimeSeconds: 0, date: today };
  }

  // ── Compute fresh monthly summary ──────────────────────────────────────────
  const [yyyy, mm] = today.split('-').map(Number);
  const monthSummary = await service.computeMonthlySummary(id, mm, yyyy);

  return {
    date: finalRecord.date,
    status: finalRecord.status,
    talkTimeSeconds: finalRecord.talkTimeSeconds || 0,
    monthSummary
  };
}

/**
 * GET /api/agents/:id/attendance/monthly?month=10&year=2026
 *
 * Extended monthly summary.  Keeps `present` (= fullDay) for backward compat.
 *
 * @param {string} id
 * @param {string|number} month  1-12
 * @param {string|number} year
 */
async function getMonthlyAttendance(id, month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(m) || m < 1 || m > 12) {
    throw createError('month must be a number between 1 and 12', 'ValidationError');
  }
  if (isNaN(y) || y < 2000 || y > 2100) {
    throw createError('year must be a valid 4-digit year', 'ValidationError');
  }

  await resolveAgent(id);

  return service.computeMonthlySummary(id, m, y);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

const service = {
  getTodayAttendance,
  upsertTodayAttendance,
  getMonthlyAttendance,
  // Exported for unit tests
  getTodayIST,
  getYesterdayIST,
  isWeekOff,
  computeMonthlySummary,
  STATUS_RANK,
  RULES
};

module.exports = service;
