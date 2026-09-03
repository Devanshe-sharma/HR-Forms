// One-off verification — mounts the real salaryRevisions router on an
// isolated throwaway port (not the live dev server on 5000), and confirms
// the new access-control rules actually behave as intended: no token is
// rejected, Employee is rejected, Manager sees only their own reports, HR
// sees everything, and the public /mail-action routes still work without
// any token at all. No real data is mutated, no emails are sent (GET-only
// checks; the one PUT check uses a disposable test revision).
require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const SalaryRevision = require('../models/SalaryRevision');

const PORT = 5556;
const BASE = `http://localhost:${PORT}/api/salary-revisions`;

function tokenFor(name, role) {
  return jwt.sign({ id: 'test-' + role, email: `${role.toLowerCase()}@test.local`, role, name }, process.env.JWT_SECRET);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const app = express();
  app.use(express.json());
  app.use('/api/salary-revisions', require('../routes/salaryRevisions'));
  const server = app.listen(PORT);

  let testRevision;
  try {
    testRevision = await SalaryRevision.create({
      employeeCode: 'TEST-ACL-VERIFY',
      employeeName: 'TEST — Access Control Verification',
      department: 'QA',
      designation: 'Test Role',
      email: 'test@example.com',
      joiningDate: new Date('2025-01-01'),
      previousCtc: 500000,
      previousDesignation: 'Test Role',
      previousReportingHead: 'Test Manager A',
      previousCategory: 'Employee',
      stage: 'pending_manager',
      managerRequestedAt: new Date(),
    });

    // 1. No token at all
    const noAuthRes = await fetch(`${BASE}/`);
    console.log('[1] No token -> GET / status:', noAuthRes.status, noAuthRes.status === 401 ? '(correct — rejected)' : '(WRONG — should be 401)');

    // 2. Employee role
    const employeeRes = await fetch(`${BASE}/`, { headers: { Authorization: `Bearer ${tokenFor('Some Employee', 'Employee')}` } });
    console.log('[2] Employee role -> GET / status:', employeeRes.status, employeeRes.status === 403 ? '(correct — rejected)' : '(WRONG — should be 403)');

    // 3. Manager role who is NOT this test employee's manager
    const wrongManagerRes = await fetch(`${BASE}/`, { headers: { Authorization: `Bearer ${tokenFor('Someone Else', 'Manager')}` } });
    const wrongManagerJson = await wrongManagerRes.json();
    const wrongManagerSeesTest = wrongManagerJson.some((r) => r.employeeCode === 'TEST-ACL-VERIFY');
    console.log('[3] Manager (not the real manager) -> status:', wrongManagerRes.status, '| sees test revision:', wrongManagerSeesTest, wrongManagerSeesTest ? '(WRONG)' : '(correct — filtered out)');

    // 4. Manager role who IS this test employee's manager
    const rightManagerRes = await fetch(`${BASE}/`, { headers: { Authorization: `Bearer ${tokenFor('Test Manager A', 'Manager')}` } });
    const rightManagerJson = await rightManagerRes.json();
    const rightManagerSeesTest = rightManagerJson.some((r) => r.employeeCode === 'TEST-ACL-VERIFY');
    const rightManagerCount = rightManagerJson.length;
    console.log('[4] Manager (the real manager) -> status:', rightManagerRes.status, '| sees test revision:', rightManagerSeesTest, rightManagerSeesTest ? '(correct)' : '(WRONG)', '| total visible to them:', rightManagerCount, '(should be small, not everyone)');

    // 5. HR role sees everything (including the test revision)
    const hrRes = await fetch(`${BASE}/`, { headers: { Authorization: `Bearer ${tokenFor('HR Person', 'HR')}` } });
    const hrJson = await hrRes.json();
    console.log('[5] HR role -> status:', hrRes.status, '| total visible:', hrJson.length, '| sees test revision:', hrJson.some((r) => r.employeeCode === 'TEST-ACL-VERIFY'));

    // 6. Manager trying to submit a decision for an employee who is NOT theirs
    const wrongManagerPut = await fetch(`${BASE}/${testRevision._id}/manager`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor('Someone Else', 'Manager')}` },
      body: JSON.stringify({ decision: 'increment', recommendedPct: 5, reason: 'should be blocked' }),
    });
    console.log('[6] Wrong manager PUT /:id/manager -> status:', wrongManagerPut.status, wrongManagerPut.status === 403 ? '(correct — blocked)' : '(WRONG)');

    // 7. Public mail-action route still works with NO token
    const mailActionRes = await fetch(`${BASE}/${testRevision._id}/mail-action?role=manager&sig=deadbeef`);
    console.log('[7] Public mail-action, no token -> status:', mailActionRes.status, '(403 expected here for bad sig, NOT 401 — confirms no auth middleware blocks it first)');

    console.log('\n✅ Access control checks complete.');
  } finally {
    if (testRevision) await SalaryRevision.findByIdAndDelete(testRevision._id);
    server.close();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ Verification FAILED:', err.message);
  process.exitCode = 1;
});
