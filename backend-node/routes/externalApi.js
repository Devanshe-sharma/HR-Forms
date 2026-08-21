/**
 * backend-node/routes/externalApi.js
 *
 * Public, API-key-gated endpoints meant for external tools/integrations
 * (Sheets, Zapier, another server) — not for this app's own frontend,
 * which uses the JWT-authenticated /api/* routes instead.
 *
 * Auth: every request must include header  x-api-key: <EXTERNAL_EMPLOYEES_API_KEY>
 */

const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/apiKeyAuth');
const { getEmployeeMasterList } = require('../utils/employeeMaster');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/external/employees
// Same data as the Employees List page (sourced from Onboarding, the
// master record for this data).
router.get(
  '/employees',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const employees = await getEmployeeMasterList();
    res.json({ success: true, data: employees });
  })
);

module.exports = router;
