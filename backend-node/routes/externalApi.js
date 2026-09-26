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

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

module.exports = router;
