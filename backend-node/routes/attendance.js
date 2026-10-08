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
const { buildDailyReport, buildMonthlyReport, buildMonthlySummary } = require('../utils/attendanceReport');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const FULL_ACCESS_ROLES = ['Admin', 'HR', 'Management'];

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
