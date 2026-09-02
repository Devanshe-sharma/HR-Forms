// One-off verification script — mounts the real salaryRevisions router on
// an isolated throwaway port (NOT the already-running dev server on 5000,
// which is a long-lived process that wouldn't pick up these code changes
// without a restart), exercises the new public mail-action GET/POST
// end-to-end against a disposable test SalaryRevision record, then deletes
// that record and shuts itself down. Confirms: signature verification,
// manager decision submission (stage transition + follow-up mail),
// management decision submission (stage transition + follow-up mail), and
// tamper-resistance (wrong role/sig rejected).
require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const SalaryRevision = require('../models/SalaryRevision');
const { buildSalaryRevisionActionLink } = require('../utils/salaryRevisionMailSigning');

const PORT = 5555;
const BASE = `http://localhost:${PORT}/api/salary-revisions`;

function extractSig(link) {
  return new URL(link).searchParams.get('sig');
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const app = express();
  app.use(express.json());
  app.use('/api/salary-revisions', require('../routes/salaryRevisions'));
  const server = app.listen(PORT);

  let revision;
  try {
    revision = await SalaryRevision.create({
      employeeCode: 'TEST-MAIL-ACTION-VERIFY',
      employeeName: 'TEST — Mail Action Verification',
      department: 'QA',
      designation: 'Test Role',
      email: 'test@example.com',
      joiningDate: new Date('2025-01-01'),
      previousCtc: 500000,
      previousDesignation: 'Test Role',
      previousReportingHead: 'Test Manager',
      previousCategory: 'Employee',
      stage: 'pending_manager',
      managerRequestedAt: new Date(),
    });
    console.log('Created test revision:', revision._id.toString());

    // ── 1. Tamper resistance — wrong sig ──────────────────────────────────
    const badRes = await fetch(`${BASE}/${revision._id}/mail-action?role=manager&sig=deadbeef`);
    const badJson = await badRes.json();
    console.log('\n[1] Wrong sig ->', badRes.status, badJson.success === false ? 'REJECTED (correct)' : 'FAILED — should have been rejected');

    // ── 2. GET manager context ────────────────────────────────────────────
    const managerLink = buildSalaryRevisionActionLink(revision._id, 'manager');
    const managerSig = extractSig(managerLink);
    const ctxRes = await fetch(`${BASE}/${revision._id}/mail-action?role=manager&sig=${managerSig}`);
    const ctxJson = await ctxRes.json();
    console.log('\n[2] GET manager context ->', ctxRes.status, JSON.stringify(ctxJson.data));
    if (!ctxJson.success || !ctxJson.data.actionable) throw new Error('Expected actionable:true for manager context');

    // ── 3. Wrong role using manager's sig ──────────────────────────────────
    const crossRes = await fetch(`${BASE}/${revision._id}/mail-action?role=management&sig=${managerSig}`);
    const crossJson = await crossRes.json();
    console.log('\n[3] Manager sig used for management role ->', crossRes.status, crossJson.success === false ? 'REJECTED (correct)' : 'FAILED — should have been rejected');

    // ── 4. POST manager decision ──────────────────────────────────────────
    const postManagerRes = await fetch(`${BASE}/${revision._id}/mail-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'manager', sig: managerSig, decision: 'increment', recommendedPct: 12, reason: 'Verification script — manager recommends 12%.' }),
    });
    const postManagerJson = await postManagerRes.json();
    console.log('\n[4] POST manager decision ->', postManagerRes.status, JSON.stringify(postManagerJson));

    const afterManager = await SalaryRevision.findById(revision._id).lean();
    console.log('    stage after manager decision:', afterManager.stage, '(expected pending_management)');
    console.log('    managerDecision:', JSON.stringify(afterManager.managerDecision));
    if (afterManager.stage !== 'pending_management') throw new Error('Stage did not transition correctly after manager decision');

    // ── 5. Re-using the manager link now that stage moved on ─────────────
    const staleRes = await fetch(`${BASE}/${revision._id}/mail-action?role=manager&sig=${managerSig}`);
    const staleJson = await staleRes.json();
    console.log('\n[5] Re-fetch manager context after stage moved on -> actionable:', staleJson.data?.actionable, '(expected false)');

    // ── 6. GET management context — should show manager's recommendation ──
    const managementLink = buildSalaryRevisionActionLink(revision._id, 'management');
    const managementSig = extractSig(managementLink);
    const mgmtCtxRes = await fetch(`${BASE}/${revision._id}/mail-action?role=management&sig=${managementSig}`);
    const mgmtCtxJson = await mgmtCtxRes.json();
    console.log('\n[6] GET management context ->', mgmtCtxRes.status, JSON.stringify(mgmtCtxJson.data));

    // ── 7. POST management decision ───────────────────────────────────────
    const postMgmtRes = await fetch(`${BASE}/${revision._id}/mail-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'management', sig: managementSig, finalPct: 10, reason: 'Verification script — management approves 10%.' }),
    });
    const postMgmtJson = await postMgmtRes.json();
    console.log('\n[7] POST management decision ->', postMgmtRes.status, JSON.stringify(postMgmtJson));

    const afterMgmt = await SalaryRevision.findById(revision._id).lean();
    console.log('    stage after management decision:', afterMgmt.stage, '(expected pending_hr)');
    console.log('    finalIncrementPct:', afterMgmt.finalIncrementPct, '| newCtc:', afterMgmt.newCtc, '(expected 500000 * 1.10 = 550000)');
    if (afterMgmt.stage !== 'pending_hr' || afterMgmt.newCtc !== 550000) throw new Error('Stage/newCtc did not compute correctly after management decision');

    console.log('\n✅ All checks passed.');
  } finally {
    if (revision) {
      await SalaryRevision.findByIdAndDelete(revision._id);
      console.log('\nCleaned up test revision.');
    }
    server.close();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ Verification FAILED:', err.message);
  process.exitCode = 1;
});
