/**
 * backend-node/routes/attendance.js
 *
 * Internal, JWT-authenticated read access to the punch data the external
 * attendance vendor pushes into POST /api/external/attendance (see
 * routes/externalApi.js). Query-only for now — there's no UI yet, this is
 * meant for verifying data is actually landing (e.g. via Postman) and as a
 * starting point once a real Attendance dashboard/report is built.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../config/roles');
const AttendancePunch = require('../models/AttendancePunch');
const Onboarding = require('../models/onboardingModel');
const { buildDailyReport, buildMonthlyReport, buildMonthlySummary } = require('../utils/attendanceReport');
const { codeForName, normaliseCode, MACHINE_EMPLOYEES } = require('../utils/attendanceEmployees');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const FULL_ACCESS_ROLES = ['Admin', 'HR', 'Management'];
const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// Resolves the logged-in user's own Onboarding record by login email, then
// their machine employee code. Onboarding.empId is NOT the machine code (see
// utils/attendanceEmployees.js's header comment) — attendanceCode is the
// explicit, HR-assigned link (set from this page's "Employee Codes" tab,
// never from the onboarding form); when it's blank, fall back to a fuzzy
// name match against that same roster, the way leaves/OOO are
// cross-referenced in attendanceReport.js.
async function resolveOwnEmployeeCode(req) {
  const email = (req.user?.email || '').toLowerCase();
  if (!email) return null;
  const own = await Onboarding.findOne({ $or: [{ officialEmail: email }, { persEmail: email }] })
    .select('name attendanceCode').lean();
  if (!own) return null;
  if (own.attendanceCode) return normaliseCode(own.attendanceCode);
  if (!own.name) return null;
  return codeForName(own.name);
}

// GET /api/attendance?empId=&from=&to=&limit=
// Raw punches, newest first. empId filters to one employee's Role
// Master/Onboarding code (AttendancePunch.employeeCode); from/to filter on
// punch timestamp (inclusive), both optional, ISO date strings.
router.get('/', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const { empId, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

  const filter = {};
  if (empId) filter.employeeCode = String(empId).trim();
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const punches = await AttendancePunch.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  res.json({ success: true, count: punches.length, data: punches });
}));

// GET /api/attendance/daily?empId=&from=&to=
// Punches collapsed to one row per employee per day: firstPunch (earliest
// that day) treated as "in", lastPunch (latest) treated as "out" — this is
// the standard HR convention (first badge-in of the day / last badge-out),
// not something the vendor necessarily labels for us. Only meaningfully
// different from a single punch when there are 2+ punches that day.
router.get('/daily', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const { empId, from, to } = req.query;

  const match = {};
  if (empId) match.employeeCode = String(empId).trim();
  if (from || to) {
    match.timestamp = {};
    if (from) match.timestamp.$gte = new Date(from);
    if (to) match.timestamp.$lte = new Date(to);
  }

  const days = await AttendancePunch.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          employeeCode: '$employeeCode',
          // Bucket days in IST, not UTC, so a 00:30 IST punch isn't filed
          // under the previous day.
          day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
        },
        onboardingId: { $first: '$onboardingId' },
        employeeName: { $max: '$employeeName' },
        punchIn: { $min: '$timestamp' },
        punchOut: { $max: '$timestamp' },
        punchCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': -1, '_id.employeeCode': 1 } },
    {
      $project: {
        _id: 0,
        employeeCode: '$_id.employeeCode',
        day: '$_id.day',
        onboardingId: 1,
        employeeName: 1,
        punchIn: 1,
        // A single punch that day has no real "out" yet — leave it null
        // rather than reporting the same timestamp as both in and out.
        punchOut: { $cond: [{ $gt: ['$punchCount', 1] }, '$punchOut', null] },
        punchCount: 1,
      },
    },
  ]);

  res.json({ success: true, count: days.length, data: days });
}));

// GET /api/attendance/report?date=YYYY-MM-DD   (default: today, IST)
// One row per employee for that day, in employee-code order, with a single
// status that merges punches, the working calendar, approved leaves and Out
// of Office records (see utils/attendanceReport.js for the rules).
router.get('/report', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const todayKey = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const date = String(req.query.date || todayKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
  }
  const report = await buildDailyReport(date, todayKey);
  res.json({ success: true, ...report });
}));

const istTodayKey = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/attendance/me/monthly?month=YYYY-MM
// The logged-in employee's own month — no role restriction beyond being
// authenticated, since it can only ever return the caller's own records
// (resolveOwnEmployeeCode ignores anything the client sends).
router.get('/me/monthly', authenticate, asyncHandler(async (req, res) => {
  const todayKey = istTodayKey();
  const month = String(req.query.month || todayKey.slice(0, 7));
  if (!MONTH_RE.test(month)) return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });

  const code = await resolveOwnEmployeeCode(req);
  if (!code) {
    return res.status(404).json({ success: false, message: 'We couldn\'t match your attendance record — contact HR to confirm your name matches the attendance system.' });
  }
  res.json({ success: true, ...(await buildMonthlyReport(code, month, todayKey)) });
}));

// GET /api/attendance/roster
// The attendance machine's full employee-code list, for the "Employee
// Codes" admin tab's assignment dropdown.
router.get('/roster', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const rows = Object.entries(MACHINE_EMPLOYEES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ success: true, data: rows });
}));

// GET /api/attendance/code-mapping
// Every active (non-exited) onboarding employee, with their current
// attendanceCode (if HR has set one) and, if not, what a fuzzy name match
// against the roster would suggest — so HR can see at a glance who still
// needs a code assigned/corrected, independent of the onboarding form.
router.get('/code-mapping', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const docs = await Onboarding.find({ exitStatus: { $nin: [...EXITED_STATUS_VALUES] } })
    .select('name dept designation empId attendanceCode').sort({ name: 1 }).lean();
  const rows = docs.map(d => ({
    onboardingId: d._id,
    name: d.name || '',
    dept: d.dept || '',
    designation: d.designation || '',
    empId: d.empId || '',
    attendanceCode: d.attendanceCode ? normaliseCode(d.attendanceCode) : '',
    suggestedCode: d.attendanceCode ? null : codeForName(d.name),
  }));
  res.json({ success: true, data: rows });
}));

// PATCH /api/attendance/code-mapping/:onboardingId  { attendanceCode }
// Sets (or, with an empty string, clears) one employee's explicit machine
// code. An empty string falls back to the fuzzy name match again; any other
// value must be a real roster code.
router.patch('/code-mapping/:onboardingId', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const raw = String(req.body.attendanceCode ?? '').trim();
  const code = raw ? normaliseCode(raw) : '';
  if (code && !MACHINE_EMPLOYEES[code]) {
    return res.status(400).json({ success: false, message: 'Not a known attendance machine code' });
  }
  const doc = await Onboarding.findByIdAndUpdate(
    req.params.onboardingId, { attendanceCode: code }, { new: true },
  ).select('name attendanceCode').lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Onboarding record not found' });
  res.json({ success: true, data: { onboardingId: doc._id, name: doc.name, attendanceCode: doc.attendanceCode } });
}));

// GET /api/attendance/monthly?code=20&month=YYYY-MM
// One employee's month, day by day (up to today), with a status summary and
// the month's buffer usage. code is the machine employee code.
router.get('/monthly', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const todayKey = istTodayKey();
  const month = String(req.query.month || todayKey.slice(0, 7));
  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ success: false, message: 'code is required' });
  if (!MONTH_RE.test(month)) return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  res.json({ success: true, ...(await buildMonthlyReport(code, month, todayKey)) });
}));

// GET /api/attendance/monthly-summary?month=YYYY-MM
// Everyone's status counts for the month, in employee-code order.
router.get('/monthly-summary', authenticate, requireRole(FULL_ACCESS_ROLES), asyncHandler(async (req, res) => {
  const todayKey = istTodayKey();
  const month = String(req.query.month || todayKey.slice(0, 7));
  if (!MONTH_RE.test(month)) return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
  res.json({ success: true, ...(await buildMonthlySummary(month, todayKey)) });
}));

module.exports = router;
