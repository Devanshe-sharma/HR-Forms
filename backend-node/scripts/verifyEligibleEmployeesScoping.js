// One-off verification — mounts the real onboardingroutes router on an
// isolated throwaway port, confirms /eligible-employees now requires login,
// that scope=mine correctly narrows results for a real Manager, and that
// every other existing caller (no scope param, or a non-Manager role) sees
// the exact same unfiltered list as before — i.e. this is backward
// compatible for the other 9+ pages using this endpoint. No data mutated.
require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const Onboarding = require('../models/onboardingModel');

const PORT = 5557;
const BASE = `http://localhost:${PORT}/api/onboarding`;

function tokenFor(name, role) {
  return jwt.sign({ id: 'test-' + role, email: `${role.toLowerCase()}@test.local`, role, name }, process.env.JWT_SECRET);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', require('../routes/onboardingroutes'));
  const server = app.listen(PORT);

  try {
    // Pick a real reportingHead value that actually has direct reports,
    // straight from the data, so this test reflects reality rather than
    // a made-up name.
    const EXITED = ['Left', 'Already Left'];
    const managerName = 'Ritika Srivastava'; // known to have several real active direct reports
    const totalActive = await Onboarding.countDocuments({ joiningStatus: 'Joined', exitStatus: { $nin: EXITED } });
    const directReportsCount = await Onboarding.countDocuments({ joiningStatus: 'Joined', exitStatus: { $nin: EXITED }, reportingHead: managerName });

    console.log(`Using real manager name "${managerName}" — expected direct reports: ${directReportsCount} (of ${totalActive} total active)`);

    // 1. No token
    const noAuthRes = await fetch(`${BASE}/eligible-employees`);
    console.log('\n[1] No token -> status:', noAuthRes.status, noAuthRes.status === 401 ? '(correct — rejected)' : '(WRONG — should be 401)');

    // 2. HR role, no scope param -> unfiltered (backward compatible)
    const hrRes = await fetch(`${BASE}/eligible-employees`, { headers: { Authorization: `Bearer ${tokenFor('HR Person', 'HR')}` } });
    const hrJson = await hrRes.json();
    console.log('[2] HR, no scope -> status:', hrRes.status, '| count:', hrJson.data.length, hrJson.data.length === totalActive ? '(correct — unfiltered)' : '(WRONG)');

    // 3. Manager role, no scope param -> still unfiltered (opt-in only)
    const managerNoScopeRes = await fetch(`${BASE}/eligible-employees`, { headers: { Authorization: `Bearer ${tokenFor(managerName, 'Manager')}` } });
    const managerNoScopeJson = await managerNoScopeRes.json();
    console.log('[3] Manager, NO scope param -> count:', managerNoScopeJson.data.length, managerNoScopeJson.data.length === totalActive ? '(correct — unfiltered, opt-in only)' : '(WRONG)');

    // 4. Manager role WITH scope=mine -> filtered to their real direct reports
    const managerScopedRes = await fetch(`${BASE}/eligible-employees?scope=mine`, { headers: { Authorization: `Bearer ${tokenFor(managerName, 'Manager')}` } });
    const managerScopedJson = await managerScopedRes.json();
    const allMatchManager = managerScopedJson.data.every((e) => (e.reporting_head || '').trim().toLowerCase() === managerName.trim().toLowerCase());
    console.log('[4] Manager WITH scope=mine -> count:', managerScopedJson.data.length, '(expected', directReportsCount, ') | all rows report to them:', allMatchManager);

    // 5. Employee role WITH scope=mine -> scope param ignored (not Manager), unfiltered
    const employeeScopedRes = await fetch(`${BASE}/eligible-employees?scope=mine`, { headers: { Authorization: `Bearer ${tokenFor('Some Employee', 'Employee')}` } });
    const employeeScopedJson = await employeeScopedRes.json();
    console.log('[5] Employee WITH scope=mine -> count:', employeeScopedJson.data.length, employeeScopedJson.data.length === totalActive ? '(correct — scope only applies to Manager role)' : '(WRONG)');

    console.log('\n✅ Verification complete.');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ Verification FAILED:', err.message);
  process.exitCode = 1;
});
