/**
 * backend-node/routes/externalApi.js
 *
 * Public, API-key-gated endpoints meant for external tools/integrations
 * (Sheets, Zapier, another server) — not for this app's own frontend,
 * which uses the JWT-authenticated /api/* routes instead.
 *
 * Auth: every route below requires header  x-api-key: <its own env-backed key>
 * (see middleware/apiKeyAuth.js — each route has a separate key, not one
 * shared across every scope).
 */

const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { getEmployeeMasterList } = require('../utils/employeeMaster');
const { getEmployeeSalaryList } = require('../utils/employeeSalary');
const Escalation = require('../models/Escalation');
const AttendancePunch = require('../models/AttendancePunch');
const HiringRequisition = require('../models/HiringRequisition');
const Onboarding = require('../models/onboardingModel');
const Exit = require('../models/exitModel');
const { nameForCode } = require('../utils/attendanceEmployees');
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Turns one punch payload (whatever shape the attendance vendor actually
// sends) into what we store. The vendor hasn't shared exact field names
// yet, so this accepts a reasonably wide set of likely aliases up front —
// narrow it to the real ones once we've seen an actual payload from them.
function normalisePunch(p) {
  const employeeCode = String(
    p.employeeCode ?? p.employee_code ?? p.employee_id ??p.empId ?? p.emp_id ?? p.userId ?? p.user_id ?? p.card_no ?? ''
  ).trim();

  const timestampRaw = p.timestamp ?? p.log_datetime ?? p.logDatetime ?? p.punchTime ??p.punch_time ?? p.time ?? p.datetime ?? p.date;
  // The vendor sends zone-less local times ("2026-10-06 10:00:00") in IST,
  // but the server would otherwise read those in its own zone (UTC) — pin
  // them to +05:30. Values that already carry a zone/offset are left alone.
  const zoneless = typeof timestampRaw === 'string' &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(timestampRaw.trim());
  const timestamp = timestampRaw
    ? new Date(zoneless ? `${timestampRaw.trim().replace(' ', 'T')}+05:30` : timestampRaw)
    : null;

  const directionRaw = String(p.direction ?? p.type ?? p.punchType ?? p.punch_type ?? '').trim().toLowerCase();
  const direction =
    ['in', 'checkin', 'check-in', 'punchin', 'i'].includes(directionRaw) ? 'in' :
    ['out', 'checkout', 'check-out', 'punchout', 'o'].includes(directionRaw) ? 'out' : '';

  const deviceId = String(p.deviceId ?? p.device_id ?? p.terminalId ?? p.terminal_id ?? '').trim();

  const employeeName = String(p.employeeName ?? p.employee_name ?? p.name ?? '').trim();

  return { employeeCode, employeeName, timestamp, direction, deviceId, raw: p };
}

// GET /api/external/employees — x-api-key: <EXTERNAL_EMPLOYEES_API_KEY>
// Same data as the Employees List page (sourced from Onboarding, the
// master record for this data).
router.get(
  '/employees',
  requireApiKey('EXTERNAL_EMPLOYEES_API_KEY'),
  asyncHandler(async (req, res) => {
    const employees = await getEmployeeMasterList();
    res.json({ success: true, data: employees });
  })
);

// GET /api/external/salary — x-api-key: <EXTERNAL_SALARY_API_KEY>
// Salary-only view of every Onboarding record, keyed by employee_id — no
// contact info, personal details, or documents, just the Salary Structure
// fields (see utils/employeeSalary.js).
router.get(
  '/salary',
  requireApiKey('EXTERNAL_SALARY_API_KEY'),
  asyncHandler(async (req, res) => {
    const data = await getEmployeeSalaryList();
    res.json({ success: true, data });
  })
);

// GET /api/external/escalations — x-api-key: <EXTERNAL_ESCALATIONS_API_KEY>
// Every escalation, newest first — same data the in-app dashboard reads via
// GET /api/escalations, but for external tools rather than the frontend.
router.get(
  '/escalations',
  requireApiKey('EXTERNAL_ESCALATIONS_API_KEY'),
  asyncHandler(async (req, res) => {
    const data = await Escalation.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  })
);

// GET /api/external/scores — x-api-key: <EXTERNAL_SCORES_API_KEY>
// FMS scoring for Recruitment (Hiring Requisitions), Onboarding, and Exit,
// combined into one response under one key — same fields each dashboard
// itself uses for checklist progress/health. Field naming is NOT consistent
// between recruitment and the other two: Hiring Requisition uses
// snake_case (fms_score, total_tasks, ...), Onboarding/Exit use camelCase
// (fmsScore, totalTasks, ...) — that's each model's own existing
// convention, not something unified here. Exit has no empId field — link
// back to Onboarding by name if needed.
router.get(
  '/scores',
  requireApiKey('EXTERNAL_SCORES_API_KEY'),
  asyncHandler(async (req, res) => {
    const [recruitment, onboarding, exit] = await Promise.all([
      HiringRequisition.find()
        .select('serial_no designation hiring_dept hiring_status fmsStatus fms_score total_tasks tasks_due tasks_overdue done_in_time done_but_delayed not_yet_due closed_at')
        .sort({ serial_no: 1 })
        .lean(),
      Onboarding.find()
        .select('empId name employeeCategory joiningStatus fmsStatus fmsScore totalTasks tasksDue tasksOverdue doneInTime doneButDelayed notYetDue')
        .sort({ name: 1 })
        .lean(),
      Exit.find()
        .select('name exitStatus exitType fmsStatus fmsScore totalTasks tasksDue tasksOverdue doneInTime doneButDelayed notYetDue')
        .sort({ name: 1 })
        .lean(),
    ]);
    res.json({ success: true, data: { recruitment, onboarding, exit } });
  })
);

// POST /api/external/attendance — x-api-key: <EXTERNAL_ATTENDANCE_API_KEY>
// Inbound endpoint for the attendance/biometric vendor to push punch
// events to — the reverse direction from every other route in this file
// (they POST to us, we don't poll them). Accepts either one punch object,
// or a batch as either a raw array or { punches: [...] }, so it works
// whether their system pushes events one at a time or in a nightly/hourly
// batch. Every punch is stored as its own row (see AttendancePunch) —
// "first punch of the day = in, last = out" is derived at read time
// (GET /api/attendance), not assumed here, since a device can report more
// than 2 punches in a day.
//
// employeeCode is the attendance machine's own code, which is NOT the same
// as Onboarding.empId, so it is stored verbatim and not linked to an
// employee record (onboardingId stays null) — matching it against empId
// could attach a punch to the wrong person.
router.post(
  '/attendance',
  requireApiKey('EXTERNAL_ATTENDANCE_API_KEY'),
  asyncHandler(async (req, res) => {
    const punches = Array.isArray(req.body) ? req.body
      : Array.isArray(req.body?.punches) ? req.body.punches
      : [req.body];

    const results = { received: punches.length, inserted: 0, rejected: [] };

    for (const raw of punches) {
      const p = normalisePunch(raw || {});
      if (!p.employeeCode || !p.timestamp || isNaN(p.timestamp.getTime())) {
        results.rejected.push({ reason: 'missing/invalid employee identifier or timestamp', payload: raw });
        continue;
      }

      await AttendancePunch.create({
        employeeCode: p.employeeCode,
        employeeName: p.employeeName || nameForCode(p.employeeCode),
        onboardingId: null,
        timestamp: p.timestamp,
        direction: p.direction,
        deviceId: p.deviceId,
        raw: p.raw,
      });
      results.inserted++;
    }

    res.status(results.inserted > 0 ? 201 : 400).json({ success: results.inserted > 0, ...results });
  })
);

module.exports = router;
