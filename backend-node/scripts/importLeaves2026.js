// One-off: import historical 2026 leave data (Odoo hr_holidays export) into
// the Leave Management module. Default mode is --dry-run (no writes); pass
// --commit to actually create records. Pass --rollback <batchId> to delete
// everything tagged with that importBatch.
//
// Usage:
//   node scripts/importLeaves2026.js                     (dry run)
//   node scripts/importLeaves2026.js --commit
//   node scripts/importLeaves2026.js --rollback leaves-2026
//   node scripts/importLeaves2026.js --file="C:\path\to\file.xlsx"
//
// Does NOT restart any running backend process and does NOT touch the
// LeaveType collection — if a referenced leave type doesn't already exist,
// this stops and tells you which one, rather than creating it silently.

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const Onboarding = require('../models/onboardingModel');
const LeaveType = require('../models/LeaveType');
const LeaveAllocation = require('../models/LeaveAllocation');
const LeaveRequest = require('../models/LeaveRequest');

const IMPORT_BATCH = 'leaves-2026';
const DEFAULT_FILE = 'C:/Users/admin/Downloads/leaves_2026_import_ready.xlsx';
const PENDING_CUTOFF = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01

const PENDING_STATUSES = ['to_approve', 'second_approval'];

// ─── CLI args ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const rollbackIdx = argv.indexOf('--rollback');
const ROLLBACK_BATCH = rollbackIdx !== -1 ? argv[rollbackIdx + 1] : null;
const fileArg = argv.find((a) => a.startsWith('--file='));
const FILE_PATH = fileArg ? fileArg.slice('--file='.length).replace(/^"|"$/g, '') : DEFAULT_FILE;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeName(s) {
  return (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// Cell is read with {raw:false} so we get a plain "DD Mon YYYY" display
// string instead of an Excel serial — parsed straight into a UTC-midnight
// Date for that calendar day, with no timezone-driven day shift at all.
function parseSheetDate(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), month, parseInt(m[1], 10)));
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// Same arithmetic as utils/leaveBalance.js (allocated - used - pending),
// but over an in-memory row set rather than live Mongo queries — needed so
// a --dry-run can preview post-import balances without writing anything.
function previewBalances(allocations, requests) {
  const key = (e, t) => `${e}::${t}`;
  const allocated = new Map();
  const used = new Map();
  const pending = new Map();
  for (const a of allocations) {
    const k = key(a.employeeId, a.leaveTypeId);
    allocated.set(k, (allocated.get(k) || 0) + a.days);
  }
  for (const r of requests) {
    const k = key(r.employeeId, r.leaveTypeId);
    if (r.status === 'approved') used.set(k, (used.get(k) || 0) + r.durationDays);
    else if (PENDING_STATUSES.includes(r.status)) pending.set(k, (pending.get(k) || 0) + r.durationDays);
  }
  const keys = new Set([...allocated.keys(), ...used.keys(), ...pending.keys()]);
  const rows = [];
  for (const k of keys) {
    const [employeeId, leaveTypeId] = k.split('::');
    const a = allocated.get(k) || 0;
    const u = used.get(k) || 0;
    const p = pending.get(k) || 0;
    rows.push({ employeeId, leaveTypeId, allocated: a, used: u, pending: p, left: a - u - p });
  }
  return rows;
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

async function runRollback(batchId) {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await LeaveRequest.deleteMany({ importBatch: batchId });
  const a = await LeaveAllocation.deleteMany({ importBatch: batchId });
  console.log(`Rolled back batch "${batchId}": deleted ${r.deletedCount} request(s), ${a.deletedCount} allocation(s).`);
  await mongoose.disconnect();
}

// ─── Main import ────────────────────────────────────────────────────────────────

async function runImport() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`Source file not found: ${FILE_PATH}`);
    process.exit(1);
  }

  console.log(`Mode: ${COMMIT ? 'COMMIT (will write to the database)' : 'DRY RUN (no writes)'}`);
  console.log(`Source file: ${FILE_PATH}`);

  const wb = XLSX.readFile(FILE_PATH);
  const requestRows = XLSX.utils.sheet_to_json(wb.Sheets['Requests'], { raw: false, defval: '' });
  const allocRows = XLSX.utils.sheet_to_json(wb.Sheets['Allocations'], { raw: false, defval: '' });
  console.log(`Read ${requestRows.length} request row(s), ${allocRows.length} allocation row(s).`);

  await mongoose.connect(process.env.MONGO_URI);

  // ── Leave types — stop immediately if anything referenced is missing ──────
  const neededTypeNames = new Set([
    ...requestRows.map((r) => r['Leave type']),
    ...allocRows.map((r) => r['Leave type']),
  ].filter(Boolean));
  const allTypes = await LeaveType.find({}).lean();
  const typeByName = new Map(allTypes.map((t) => [t.name, t]));
  const missingTypes = [...neededTypeNames].filter((n) => !typeByName.has(n));
  if (missingTypes.length) {
    console.error('\nSTOPPED — the following leave type(s) are referenced in the file but do not exist in LeaveType:');
    missingTypes.forEach((n) => console.error(`  - "${n}"`));
    console.error('\nThis script will not create leave types silently. Create them first (name must match exactly'
      + ' — see routes/leaveManagement.js POST /types), then re-run.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`All ${neededTypeNames.size} referenced leave type(s) found in the database.`);

  // ── Employee matching index — ALL Onboarding records, exited included ─────
  const allOnboarding = await Onboarding.find({})
    .select('name empId dept reportingHead officialEmail persEmail exitStatus')
    .lean();
  const byEmpId = new Map();
  const byName = new Map();
  for (const o of allOnboarding) {
    const empId = (o.empId || '').trim();
    if (empId) {
      if (!byEmpId.has(empId)) byEmpId.set(empId, []);
      byEmpId.get(empId).push(o);
    }
    const nameKey = normalizeName(o.name);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(o);
  }

  function matchEmployee(empIdRaw, cleanName) {
    const empId = (empIdRaw || '').toString().trim();
    if (empId) {
      const byId = byEmpId.get(empId) || [];
      if (byId.length === 1) return { match: byId[0], method: 'empId' };
      if (byId.length > 1) return { match: null, reason: `${byId.length} Onboarding records share empId "${empId}"` };
      // empId present but resolved nothing — fall through to name matching.
    }
    const nameKey = normalizeName(cleanName);
    const byN = byName.get(nameKey) || [];
    if (byN.length === 1) return { match: byN[0], method: 'name' };
    if (byN.length === 0) return { match: null, reason: 'no Onboarding record matches this name' };
    return { match: null, reason: `${byN.length} Onboarding records share this name — ambiguous, not guessing` };
  }

  // ── Existing DB state (for idempotency + an accurate balance preview) ─────
  const existingAllocations = await LeaveAllocation.find({})
    .select('employeeId leaveTypeId days validFrom validTo').lean();
  const existingRequests = await LeaveRequest.find({})
    .select('employeeId leaveTypeId dateFrom dateTo durationDays status').lean();

  const allocDupeKey = (a) => `${a.employeeId}::${a.leaveTypeId}::${a.days}::${+new Date(a.validFrom)}::${a.validTo ? +new Date(a.validTo) : 'null'}`;
  const existingAllocKeys = new Set(existingAllocations.map(allocDupeKey));

  const reqDupeKey = (r) => `${r.employeeId}::${r.leaveTypeId}::${+new Date(r.dateFrom)}::${+new Date(r.dateTo)}::${r.durationDays}::${r.status}`;
  const existingReqKeys = new Set(existingRequests.map(reqDupeKey));

  // ── Process allocations ────────────────────────────────────────────────────
  const unmatched = [];
  const allocToCreate = [];
  let allocDuplicateSkips = 0;

  for (const row of allocRows) {
    const { match, reason } = matchEmployee(row['Emp ID (from name)'], row['Employee (clean)']);
    if (!match) {
      unmatched.push({ sheet: 'Allocations', sourceRow: row['Source row'], employeeRaw: row['Employee (raw)'], cleanName: row['Employee (clean)'], empId: row['Emp ID (from name)'], reason });
      continue;
    }
    const leaveType = typeByName.get(row['Leave type']);
    const validFrom = parseSheetDate(row['Valid from']);
    const validTo = parseSheetDate(row['Valid to']);
    const days = parseFloat(row['Days']);

    const candidate = {
      employeeId: String(match._id),
      employeeCode: match.empId || '',
      employeeName: match.name || '',
      department: match.dept || '',
      leaveTypeId: String(leaveType._id),
      days, validFrom, validTo,
      note: row['Description'] || '',
    };

    if (existingAllocKeys.has(allocDupeKey(candidate)) || allocToCreate.some((c) => allocDupeKey(c) === allocDupeKey(candidate))) {
      allocDuplicateSkips += 1;
      continue;
    }
    allocToCreate.push(candidate);
  }

  // ── Process requests ───────────────────────────────────────────────────────
  const reqToCreate = [];
  let reqDuplicateSkips = 0;
  let stalePendingCount = 0;

  for (const row of requestRows) {
    const { match, reason } = matchEmployee(row['Emp ID (from name)'], row['Employee (clean)']);
    if (!match) {
      unmatched.push({ sheet: 'Requests', sourceRow: row['Source row'], employeeRaw: row['Employee (raw)'], cleanName: row['Employee (clean)'], empId: row['Emp ID (from name)'], reason });
      continue;
    }
    const leaveType = typeByName.get(row['Leave type']);
    const dateFrom = parseSheetDate(row['From']);
    const dateTo = parseSheetDate(row['To']);
    const durationDays = parseFloat(row['Days']);
    const status = row['Import status'];

    if (status === 'to_approve' && dateFrom < PENDING_CUTOFF) stalePendingCount += 1;

    const candidate = {
      employeeId: String(match._id),
      employeeCode: match.empId || '',
      employeeName: match.name || '',
      department: match.dept || '',
      designation: '',
      employeeEmail: match.officialEmail || match.persEmail || '',
      reportingHead: match.reportingHead || '',
      leaveTypeId: String(leaveType._id),
      dateFrom, dateTo, durationDays,
      halfDay: { enabled: false, session: null },
      reason: row['Reason'] || '',
      status,
    };

    if (existingReqKeys.has(reqDupeKey(candidate)) || reqToCreate.some((c) => reqDupeKey(c) === reqDupeKey(candidate))) {
      reqDuplicateSkips += 1;
      continue;
    }
    reqToCreate.push(candidate);
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  console.log('\n--- Allocations ---');
  console.log(`  to create:        ${allocToCreate.length}`);
  console.log(`  duplicate (skip): ${allocDuplicateSkips}`);
  console.log(`  unmatched (skip): ${unmatched.filter((u) => u.sheet === 'Allocations').length}`);

  console.log('\n--- Requests ---');
  console.log(`  to create:        ${reqToCreate.length}`);
  console.log(`  duplicate (skip): ${reqDuplicateSkips}`);
  console.log(`  unmatched (skip): ${unmatched.filter((u) => u.sheet === 'Requests').length}`);
  console.log(`  pending ('to_approve') requests starting before 2026-09-01: ${stalePendingCount}`);

  if (unmatched.length) {
    const outDir = path.dirname(FILE_PATH);
    const csvPath = path.join(outDir, 'leaves_2026_unmatched.csv');
    writeCsv(csvPath, unmatched, ['sheet', 'sourceRow', 'employeeRaw', 'cleanName', 'empId', 'reason']);
    console.log(`\n${unmatched.length} unmatched row(s) written to: ${csvPath}`);
  } else {
    console.log('\nNo unmatched rows.');
  }

  // ── Balance preview (existing DB state + this run's candidates) ───────────
  const previewAllocations = [
    ...existingAllocations.map((a) => ({ employeeId: String(a.employeeId), leaveTypeId: String(a.leaveTypeId), days: a.days })),
    ...allocToCreate,
  ];
  const previewRequests = [
    ...existingRequests.map((r) => ({ employeeId: String(r.employeeId), leaveTypeId: String(r.leaveTypeId), durationDays: r.durationDays, status: r.status })),
    ...reqToCreate,
  ];
  const balanceRows = previewBalances(previewAllocations, previewRequests);
  const onboardingById = new Map(allOnboarding.map((o) => [String(o._id), o]));
  const typeById = new Map(allTypes.map((t) => [String(t._id), t]));

  // Rounded to 2dp for display only — pure floating-point noise (e.g.
  // 6 - 5.6 - 0.4 printing as 3.8e-16), not a real fractional-day balance.
  // Underlying stored values are untouched.
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  console.log(`\n--- Balance preview after ${COMMIT ? 'this commit' : 'this import (dry run)'} (${balanceRows.length} employee/type combinations) ---`);
  console.log('employee,leaveType,allocated,used,pending,left');
  for (const b of balanceRows.sort((x, y) => (onboardingById.get(x.employeeId)?.name || '').localeCompare(onboardingById.get(y.employeeId)?.name || ''))) {
    const empName = onboardingById.get(b.employeeId)?.name || b.employeeId;
    const typeName = typeById.get(b.leaveTypeId)?.name || b.leaveTypeId;
    console.log(`${empName},${typeName},${round2(b.allocated)},${round2(b.used)},${round2(b.pending)},${round2(b.left)}`);
  }

  console.log('\nNOTE: the source workbook has no "Employee-wise" sheet (only Read me / Requests / Allocations /'
    + ' Employees to match exist) — the cross-check against it specified in the import instructions could not be run.'
    + ' The balance preview above is the best available substitute.');

  // ── Commit ──────────────────────────────────────────────────────────────────

  if (!COMMIT) {
    console.log(`\nDry run complete. Re-run with --commit to write ${allocToCreate.length} allocation(s) and ${reqToCreate.length} request(s).`);
    console.log(`Import batch id: ${IMPORT_BATCH}`);
    console.log(`To undo after committing: node scripts/importLeaves2026.js --rollback ${IMPORT_BATCH}`);
    await mongoose.disconnect();
    return;
  }

  console.log('\nCommitting...');
  let allocCreated = 0;
  for (const a of allocToCreate) {
    await LeaveAllocation.create({
      employeeId: a.employeeId, employeeCode: a.employeeCode, employeeName: a.employeeName, department: a.department,
      leaveTypeId: a.leaveTypeId, days: a.days, validFrom: a.validFrom, validTo: a.validTo,
      status: 'approved', note: a.note, createdBy: 'system (import)',
      source: 'odoo_import', importBatch: IMPORT_BATCH,
    });
    allocCreated += 1;
  }

  let reqCreated = 0;
  for (const r of reqToCreate) {
    const doc = new LeaveRequest({
      employeeId: r.employeeId, employeeCode: r.employeeCode, employeeName: r.employeeName,
      department: r.department, designation: r.designation, employeeEmail: r.employeeEmail,
      reportingHead: r.reportingHead, leaveTypeId: r.leaveTypeId,
      dateFrom: r.dateFrom, dateTo: r.dateTo, halfDay: r.halfDay, durationDays: r.durationDays,
      reason: r.reason, status: r.status, createdBy: 'system (import)',
      source: 'odoo_import', importBatch: IMPORT_BATCH,
    });
    doc.auditLog.push({ action: 'Imported from Odoo', by: 'system', at: new Date(), fromStatus: '', toStatus: r.status, note: '' });
    await doc.save();
    reqCreated += 1;
  }

  console.log(`Committed: ${allocCreated} allocation(s), ${reqCreated} request(s).`);
  console.log(`Import batch id: ${IMPORT_BATCH}`);
  console.log(`To undo: node scripts/importLeaves2026.js --rollback ${IMPORT_BATCH}`);
  console.log('\nThis script did not restart any backend process — restart it so the app picks up the imported data'
    + ' (and the source/importBatch schema fields, if the process has been running since before this script added them).');

  await mongoose.disconnect();
}

(async () => {
  if (ROLLBACK_BATCH) {
    await runRollback(ROLLBACK_BATCH);
    return;
  }
  await runImport();
})().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
