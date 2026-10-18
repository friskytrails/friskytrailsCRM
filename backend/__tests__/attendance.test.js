'use strict';

/**
 * Attendance API — Comprehensive Test Suite
 *
 * Coverage:
 *   Unit tests   — attendanceService helpers (pure logic, no DB)
 *   Integration  — all 3 HTTP endpoints via supertest + in-memory MongoDB
 *
 * All 11 spec test cases from §11 are covered, plus auth/permission,
 * edge cases, backward-compat, and input validation.
 *
 * Strategy: MongoMemoryServer starts before any module loads. We set
 * MONGODB_URI in process.env *before* requiring app so that config/index.js
 * picks up the test URI.  bookingDb is mocked to a no-op so it does not try
 * to connect to a real Atlas cluster.
 */

jest.mock('../db/bookingDb', () => ({
  connectBookingDB: jest.fn().mockResolvedValue(null)
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// ─── In-memory MongoDB ────────────────────────────────────────────────────────
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Set env vars BEFORE any app module is loaded
  process.env.MONGODB_URI = uri;
  process.env.BOOKING_MONGODB_URI = '';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.PORT = '0'; // random OS-assigned port

  // Connect mongoose directly (app's connectDB will reuse the open connection)
  await mongoose.connect(uri);
}, 120000);

afterEach(async () => {
  // Clear all documents between tests
  const cols = Object.values(mongoose.connection.collections);
  await Promise.all(cols.map(c => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

// ─── Lazy-load app & modules after env is set ─────────────────────────────────
// These are required inside describe/test blocks (or in beforeAll) so they
// read the patched MONGODB_URI from process.env.

function getApp() { return require('../index'); }
function getAttendanceService() { return require('../services/attendanceService'); }
function getAttendance() { return require('../models/Attendance'); }
function getUser() { return require('../models/User').Model; }

// ─── JWT helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-key';
const jwt = require('jsonwebtoken');

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// ─── IST date helpers (mirrors service) ──────────────────────────────────────

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function yesterdayIST() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function tomorrowIST() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── Factories ────────────────────────────────────────────────────────────────

async function createAgent(overrides = {}) {
  const User = getUser();
  return User.create({
    name: 'Test Agent',
    email: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'hashed',
    isAdmin: false,
    isManager: false,
    status: 'Active',
    ...overrides
  });
}

async function createAdmin(overrides = {}) {
  return createAgent({ name: 'Admin User', isAdmin: true, ...overrides });
}

async function createManager(overrides = {}) {
  return createAgent({ name: 'Manager User', isManager: true, ...overrides });
}

function agentToken(user) {
  return makeToken({
    userId: user._id.toString(),
    isAdmin: !!user.isAdmin,
    isManager: !!user.isManager
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//   UNIT TESTS — attendanceService helpers (pure / deterministic)
// ══════════════════════════════════════════════════════════════════════════════

describe('attendanceService — unit tests', () => {
  let svc;
  beforeAll(() => { svc = getAttendanceService(); });

  // ── getTodayIST ──────────────────────────────────────────────────────────

  describe('getTodayIST', () => {
    it('returns a YYYY-MM-DD string', () => {
      expect(svc.getTodayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('equals the test helper todayIST()', () => {
      expect(svc.getTodayIST()).toBe(todayIST());
    });
  });

  // ── isWeekOff ────────────────────────────────────────────────────────────

  describe('isWeekOff', () => {
    it('returns true for a known Sunday (2026-10-18)', () => {
      expect(svc.isWeekOff('2026-10-18')).toBe(true);
    });
    it('returns false for a known Monday (2026-10-19)', () => {
      expect(svc.isWeekOff('2026-10-19')).toBe(false);
    });
    it('returns false for a Saturday — only Sunday is week-off', () => {
      // 2026-10-17 is Saturday
      expect(svc.isWeekOff('2026-10-17')).toBe(false);
    });
    it('returns false for a Friday', () => {
      // 2026-10-16 is Friday
      expect(svc.isWeekOff('2026-10-16')).toBe(false);
    });
  });

  // ── STATUS_RANK ──────────────────────────────────────────────────────────

  describe('STATUS_RANK', () => {
    it('A < H', () => expect(svc.STATUS_RANK.A).toBeLessThan(svc.STATUS_RANK.H));
    it('H < P', () => expect(svc.STATUS_RANK.H).toBeLessThan(svc.STATUS_RANK.P));
  });

  // ── RULES shape ───────────────────────────────────────────────────────────

  describe('RULES', () => {
    it('halfDayMinSeconds is 3600', () => expect(svc.RULES.halfDayMinSeconds).toBe(3600));
    it('fullDayMinSeconds is 6000', () => expect(svc.RULES.fullDayMinSeconds).toBe(6000));
    it('weekOffDays contains 0 (Sunday)', () => expect(svc.RULES.weekOffDays).toContain(0));
  });

  // ── computeMonthlySummary ─────────────────────────────────────────────────

  describe('computeMonthlySummary', () => {
    let agent;
    beforeEach(async () => { agent = await createAgent(); });

    it('31 days in October always split into (absent + weekOff + fullDay + halfDay) = 31', async () => {
      const r = await svc.computeMonthlySummary(agent._id, 10, 2025);
      expect(r.fullDay + r.halfDay + r.absent + r.weekOff).toBe(31);
    });

    it('keeps present === fullDay (backward compat)', async () => {
      const r = await svc.computeMonthlySummary(agent._id, 10, 2025);
      expect(r.present).toBe(r.fullDay);
    });

    it('counts Sundays as weekOff even if a P record exists', async () => {
      const Attendance = getAttendance();
      // 2026-10-18 is a Sunday
      await Attendance.create({ agentId: agent._id, date: '2026-10-18', status: 'P' });
      const r = await svc.computeMonthlySummary(agent._id, 10, 2026);
      expect(r.weekOff).toBeGreaterThanOrEqual(1);
      // The Sunday record must NOT inflate fullDay
      expect(r.fullDay).toBe(0);
    });

    it('a P record on a weekday counts as fullDay', async () => {
      const Attendance = getAttendance();
      // 2025-10-01 is a Wednesday
      await Attendance.create({ agentId: agent._id, date: '2025-10-01', status: 'P' });
      const r = await svc.computeMonthlySummary(agent._id, 10, 2025);
      expect(r.fullDay).toBe(1);
    });

    it('an H record on a weekday counts as halfDay', async () => {
      const Attendance = getAttendance();
      await Attendance.create({ agentId: agent._id, date: '2025-10-01', status: 'H' });
      const r = await svc.computeMonthlySummary(agent._id, 10, 2025);
      expect(r.halfDay).toBe(1);
    });

    it('a missing weekday counts as absent', async () => {
      const r = await svc.computeMonthlySummary(agent._id, 10, 2025);
      // October 2025 has 27 weekdays (Mon-Sat) — none have records → all absent
      expect(r.absent).toBeGreaterThan(0);
    });

    it('today is not included in totals for current month', async () => {
      const Attendance = getAttendance();
      const today = todayIST();
      const [y, m] = today.split('-').map(Number);
      await Attendance.create({ agentId: agent._id, date: today, status: 'P' });
      const r = await svc.computeMonthlySummary(agent._id, m, y);
      // fullDay should be 0 because today (with the P) is excluded
      // (assuming no other finished P days this month, which is true in a fresh test)
      const yesterday = yesterdayIST();
      const [yy, mm] = yesterday.split('-').map(Number);
      if (yy === y && mm === m) {
        // Only assert when yesterday is in the same month
        expect(r.fullDay).toBe(0);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//   INTEGRATION TESTS — GET /api/agents/:id/attendance/today
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/agents/:id/attendance/today', () => {
  let agent, token, app;

  beforeAll(() => { app = getApp(); });
  beforeEach(async () => {
    agent = await createAgent();
    token = agentToken(agent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('200 — default A with talkTimeSeconds 0 when no record exists on a working day', async () => {
    jest.spyOn(getAttendanceService(), 'isWeekOff').mockReturnValue(false);
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: todayIST(),
      status: 'A',
      talkTimeSeconds: 0,
      isWeekOff: false,
      weekday: expect.any(String),
      rules: {
        halfDayMinSeconds: 3600,
        fullDayMinSeconds: 6000,
        weekOffDays: [0]
      }
    });
  });

  it('200 — default WO with talkTimeSeconds 0 when no record exists on a week-off day', async () => {
    jest.spyOn(getAttendanceService(), 'isWeekOff').mockReturnValue(true);
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: todayIST(),
      status: 'WO',
      talkTimeSeconds: 0,
      isWeekOff: true,
      weekday: expect.any(String),
      rules: {
        halfDayMinSeconds: 3600,
        fullDayMinSeconds: 6000,
        weekOffDays: [0]
      }
    });
  });

  it('200 — returns stored H record', async () => {
    const Attendance = getAttendance();
    await Attendance.create({ agentId: agent._id, date: todayIST(), status: 'H', talkTimeSeconds: 3612 });

    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('H');
    expect(res.body.talkTimeSeconds).toBe(3612);
  });

  it('200 — manager can view another agent', async () => {
    const manager = await createManager();
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${agentToken(manager)}`);
    expect(res.status).toBe(200);
  });

  it('200 — admin can view any agent', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${agentToken(admin)}`);
    expect(res.status).toBe(200);
  });

  it('401 — missing Authorization header', async () => {
    const res = await request(app).get(`/api/agents/${agent._id}/attendance/today`);
    expect(res.status).toBe(401);
  });

  it('401 — malformed token (not Bearer)', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Token ${token}`);
    expect(res.status).toBe(401);
  });

  it('[spec] 403 — agent A cannot view agent B', async () => {
    const agentB = await createAgent();
    const res = await request(app)
      .get(`/api/agents/${agentB._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('[spec] 404 — admin id returns 404', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get(`/api/agents/${admin._id}/attendance/today`)
      .set('Authorization', `Bearer ${agentToken(admin)}`);
    expect(res.status).toBe(404);
  });

  it('400 — invalid ObjectId format', async () => {
    const res = await request(app)
      .get('/api/agents/not-valid-id/attendance/today')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('error shape has "error" key', async () => {
    const agentB = await createAgent();
    const res = await request(app)
      .get(`/api/agents/${agentB._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//   INTEGRATION TESTS — PUT /api/agents/:id/attendance/today
// ══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/agents/:id/attendance/today', () => {
  let agent, token, app, Attendance;

  beforeAll(() => {
    app = getApp();
    Attendance = getAttendance();
  });
  beforeEach(async () => {
    agent = await createAgent();
    token = agentToken(agent);
    jest.spyOn(getAttendanceService(), 'isWeekOff').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Spec §11 test cases ──────────────────────────────────────────────────

  it('[spec] Sunday: returns WO with no DB write', async () => {
    jest.spyOn(getAttendanceService(), 'isWeekOff').mockReturnValue(true);
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H', talkTimeSeconds: 3612 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WO');
    expect(res.body.monthSummary).toBeDefined();

    const count = await Attendance.countDocuments({ agentId: agent._id, date: todayIST() });
    expect(count).toBe(0);
  });

  it('[spec] Normal rise: no record → send H → saved H', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H', talkTimeSeconds: 3612 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('H');
    expect(res.body.talkTimeSeconds).toBe(3612);
    expect(res.body.monthSummary).toBeDefined();
  });

  it('[spec] Next rise: stored H → send P → saved P', async () => {
    await Attendance.create({ agentId: agent._id, date: todayIST(), status: 'H', talkTimeSeconds: 3612 });

    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'P', talkTimeSeconds: 6100 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('P');
  });

  it('[spec] Retry: stored P → send P again → 200, unchanged, still 1 DB record', async () => {
    await Attendance.create({ agentId: agent._id, date: todayIST(), status: 'P', talkTimeSeconds: 6100 });

    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'P', talkTimeSeconds: 6100 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('P');
    const count = await Attendance.countDocuments({ agentId: agent._id, date: todayIST() });
    expect(count).toBe(1);
  });

  it('[spec] Late lower value: stored P → send H → 200, still P', async () => {
    await Attendance.create({ agentId: agent._id, date: todayIST(), status: 'P', talkTimeSeconds: 6100 });

    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H', talkTimeSeconds: 3612 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('P');
  });

  it('[spec] Skip a step: no record → send P → saved P', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'P', talkTimeSeconds: 6100 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('P');
  });

  it('[spec] Wrong date: yesterday → 400', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: yesterdayIST(), status: 'H' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('[spec] Future date: tomorrow → 400', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: tomorrowIST(), status: 'H' });

    expect(res.status).toBe(400);
  });

  it('[spec] Invalid status "WO" → 400', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'WO' });

    expect(res.status).toBe(400);
  });

  it('[spec] Invalid status "X" → 400', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'X' });

    expect(res.status).toBe(400);
  });

  it('[spec] Wrong agent: A calls for B → 403', async () => {
    const agentB = await createAgent();
    const res = await request(app)
      .put(`/api/agents/${agentB._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H' });

    expect(res.status).toBe(403);
  });

  it('[spec] Admin id → 404', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .put(`/api/agents/${admin._id}/attendance/today`)
      .set('Authorization', `Bearer ${agentToken(admin)}`)
      .send({ date: todayIST(), status: 'H' });

    expect(res.status).toBe(404);
  });

  // ── Additional edge cases ─────────────────────────────────────────────────

  it('400 — missing date', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'H' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date/i);
  });

  it('400 — missing status', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST() });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('200 — talkTimeSeconds optional, defaults to 0', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H' });

    expect(res.status).toBe(200);
    expect(res.body.talkTimeSeconds).toBe(0);
  });

  it('200 — manager can update agent attendance', async () => {
    const manager = await createManager();
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${agentToken(manager)}`)
      .send({ date: todayIST(), status: 'H' });

    expect(res.status).toBe(200);
  });

  it('401 — no token', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .send({ date: todayIST(), status: 'H' });
    expect(res.status).toBe(401);
  });

  it('400 — invalid ObjectId', async () => {
    const res = await request(app)
      .put('/api/agents/not-an-id/attendance/today')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H' });
    expect(res.status).toBe(400);
  });

  it('monthSummary has correct shape', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: 'H' });

    expect(res.status).toBe(200);
    expect(res.body.monthSummary).toMatchObject({
      month: expect.stringMatching(/^\d{4}-\d{2}$/),
      fullDay: expect.any(Number),
      halfDay: expect.any(Number),
      absent: expect.any(Number),
      weekOff: expect.any(Number)
    });
  });

  it('upsert idempotency — two identical calls → exactly 1 DB record', async () => {
    const body = { date: todayIST(), status: 'H', talkTimeSeconds: 3612 };
    await request(app).put(`/api/agents/${agent._id}/attendance/today`).set('Authorization', `Bearer ${token}`).send(body);
    await request(app).put(`/api/agents/${agent._id}/attendance/today`).set('Authorization', `Bearer ${token}`).send(body);

    const count = await Attendance.countDocuments({ agentId: agent._id, date: todayIST() });
    expect(count).toBe(1);
  });

  it('invalid status empty string → 400', async () => {
    const res = await request(app)
      .put(`/api/agents/${agent._id}/attendance/today`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: todayIST(), status: '' });
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//   INTEGRATION TESTS — GET /api/agents/:id/attendance/monthly
// ══════════════════════════════════════════════════════════════════════════════

describe('GET /api/agents/:id/attendance/monthly', () => {
  let agent, token, app, Attendance;

  beforeAll(() => {
    app = getApp();
    Attendance = getAttendance();
  });
  beforeEach(async () => {
    agent = await createAgent();
    token = agentToken(agent);
  });

  it('200 — correct response shape', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      month: '2025-10',
      fullDay: expect.any(Number),
      halfDay: expect.any(Number),
      absent: expect.any(Number),
      weekOff: expect.any(Number),
      present: expect.any(Number)
    });
  });

  it('[spec] Monthly, no records — all weekdays are absent, Sundays are weekOff, total = 31', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { fullDay, halfDay, absent, weekOff } = res.body;
    expect(fullDay).toBe(0);
    expect(halfDay).toBe(0);
    expect(weekOff).toBeGreaterThan(0);
    expect(absent + weekOff).toBe(31);
  });

  it('[spec] Monthly example: day1 H finished, day2 P finished → halfDay≥1, fullDay≥1', async () => {
    // Jan 2025: 1st = Wed, 2nd = Thu — both weekdays
    await Attendance.create({ agentId: agent._id, date: '2025-01-01', status: 'H' });
    await Attendance.create({ agentId: agent._id, date: '2025-01-02', status: 'P' });

    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=1&year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.halfDay).toBeGreaterThanOrEqual(1);
    expect(res.body.fullDay).toBeGreaterThanOrEqual(1);
  });

  it('[spec] Monthly, today excluded — today P does not appear in fullDay', async () => {
    const today = todayIST();
    const [y, m] = today.split('-').map(Number);
    await Attendance.create({ agentId: agent._id, date: today, status: 'P' });

    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=${m}&year=${y}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // fullDay must be 0 (today excluded, no other records)
    expect(res.body.fullDay).toBe(0);
  });

  it('backward compat: present === fullDay', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.present).toBe(res.body.fullDay);
  });

  it('October 2025 total days = 31', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2025`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { fullDay, halfDay, absent, weekOff } = res.body;
    expect(fullDay + halfDay + absent + weekOff).toBe(31);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('400 — missing month', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — missing year', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — month = 0', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=0&year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — month = 13', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=13&year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('400 — year is letters', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=abcd`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  // ── Permissions ───────────────────────────────────────────────────────────

  it('401 — no token', async () => {
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2026`);
    expect(res.status).toBe(401);
  });

  it('[spec] 403 — agent A cannot view agent B monthly', async () => {
    const agentB = await createAgent();
    const res = await request(app)
      .get(`/api/agents/${agentB._id}/attendance/monthly?month=10&year=2026`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('[spec] 404 — admin id returns 404', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get(`/api/agents/${admin._id}/attendance/monthly?month=10&year=2026`)
      .set('Authorization', `Bearer ${agentToken(admin)}`);
    expect(res.status).toBe(404);
  });

  it('200 — manager can view agent monthly', async () => {
    const manager = await createManager();
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2026`)
      .set('Authorization', `Bearer ${agentToken(manager)}`);
    expect(res.status).toBe(200);
  });

  it('200 — admin can view agent monthly', async () => {
    const admin = await createAdmin();
    const res = await request(app)
      .get(`/api/agents/${agent._id}/attendance/monthly?month=10&year=2026`)
      .set('Authorization', `Bearer ${agentToken(admin)}`);
    expect(res.status).toBe(200);
  });
});
