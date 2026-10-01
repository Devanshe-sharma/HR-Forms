// One-off script: creates a SalaryRevision (pending_manager) for every
// active employee whose Due Date falls in the CURRENT fiscal quarter,
// regardless of how close their own reminder date actually is — unlike
// the daily cron (sendSalaryRevisionAutoTrigger), which deliberately only
// acts once a person's reminder date falls within the current calendar
// month. This exists to open the whole quarter's reviews at once, on
// request, rather than letting them trigger individually through the
// quarter.
//
// Run on the server (needs real Mongo + mail credentials and
// SALARY_REVISION_MAILS_ENABLED=true to actually email managers):
//   cd /var/www/HR-Forms/backend-node
//   node scripts/openQuarterSalaryRevisions.js
//
// Safe to re-run — anyone who already has an open revision (any
// non-completed stage) is skipped, same rule as the daily cron.

require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('../models/onboardingModel');
const SalaryRevision = require('../models/SalaryRevision');
const { dueDateInRange } = require('../utils/salaryRevisionDueDate');
const { fiscalYearOf, fiscalQuarterOf, fiscalQuarterStart, fiscalQuarterEnd, fiscalYearLabel } = require('../utils/fiscalQuarter');
const { rescoreSalaryRevision } = require('../utils/salaryRevisionScoring');
const sendSalaryRevisionManagerRequest = require('../emails/senders/sendSalaryRevisionManagerRequest');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);
const OPEN_STAGES = ['pending_manager', 'pending_management', 'pending_hr', 'on_hold'];

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const now = new Date();
  const fy = fiscalYearOf(now);
  const quarter = fiscalQuarterOf(now);
  const rangeStart = fiscalQuarterStart(fy, quarter);
  const rangeEnd = fiscalQuarterEnd(fy, quarter);
  console.log(`Opening salary revisions due in Q${quarter} ${fiscalYearLabel(fy)} (${rangeStart.toDateString()} - ${rangeEnd.toDateString()})`);
  console.log('SALARY_REVISION_MAILS_ENABLED:', process.env.SALARY_REVISION_MAILS_ENABLED);

  const employees = await Onboarding.find({ joiningStatus: 'Joined' })
    .select('name dept designation officialEmail persEmail joinedDate employeeCategory contractPeriod contractStartDate contractEndDate annualCtc reportingHead exitStatus')
    .lean();
  const active = employees.filter((e) => !EXITED_STATUS_VALUES.has(e.exitStatus || '') && e.joinedDate);

  const revisionsByEmployee = new Map();
  const allRevisions = await SalaryRevision.find({
    employeeCode: { $in: active.map((e) => String(e._id)) },
  }).select('employeeCode stage applicableDate createdAt fullTimeSince').lean();
  allRevisions.forEach((r) => {
    if (!revisionsByEmployee.has(r.employeeCode)) revisionsByEmployee.set(r.employeeCode, []);
    revisionsByEmployee.get(r.employeeCode).push(r);
  });

  let createdCount = 0;
  let skippedOpen = 0;
  let notDueThisQuarter = 0;
  const createdFor = [];
  const failures = [];
  let skippedPlainIntern = 0;

  for (const e of active) {
    const revisions = revisionsByEmployee.get(String(e._id)) || [];

    const due = dueDateInRange(
      { joiningDate: e.joinedDate, employeeCategory: e.employeeCategory, contractPeriod: e.contractPeriod },
      revisions, rangeStart, rangeEnd
    );
    if (!due) { notDueThisQuarter++; continue; }

    // Plain Interns never get a formal SalaryRevision (CTC-increment)
    // workflow record or Mail 1 — same rule as the daily auto-trigger
    // cron and sendSalaryRevisionManagerRequest. They still show up in the
    // quarterly digest mail (sendSalaryRevisionDue.js) on their own due
    // date; that's a listing only, not a revision cycle.
    if (e.employeeCategory === 'Intern') { skippedPlainIntern++; continue; }

    if (revisions.some((r) => OPEN_STAGES.includes(r.stage))) { skippedOpen++; continue; }

    try {
      const revision = await SalaryRevision.create({
        onboardingId: e._id,
        employeeCode: String(e._id),
        employeeName: e.name,
        department: e.dept,
        designation: e.designation,
        email: e.officialEmail || e.persEmail,
        joiningDate: e.joinedDate,
        contractStartDate: e.contractStartDate || null,
        contractEndDate: e.contractEndDate || null,
        category: e.employeeCategory || 'Employee',
        previousCtc: e.annualCtc || 0,
        previousDesignation: e.designation,
        previousReportingHead: e.reportingHead || '',
        previousCategory: e.employeeCategory || 'Employee',
        stage: 'pending_manager',
        managerRequestedAt: now,
      });
      await rescoreSalaryRevision(revision);
      await sendSalaryRevisionManagerRequest(revision);
      createdCount++;
      createdFor.push(`${e.name} (due ${due.toDateString()})`);
    } catch (err) {
      console.error(`Failed for ${e.name}:`, err.message);
      failures.push({ name: e.name, error: err.message });
    }
  }

  console.log(`\nCreated: ${createdCount}`);
  createdFor.forEach((n) => console.log('  +', n));
  console.log(`Skipped (already had an open revision): ${skippedOpen}`);
  console.log(`Skipped (plain Intern — no formal revision, only the quarterly digest listing): ${skippedPlainIntern}`);
  console.log(`Not due this quarter: ${notDueThisQuarter}`);
  if (failures.length) console.log('Failures:', JSON.stringify(failures, null, 2));

  await mongoose.disconnect();
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
