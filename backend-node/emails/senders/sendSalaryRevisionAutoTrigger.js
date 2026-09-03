const Onboarding = require('../../models/onboardingModel');
const SalaryRevision = require('../../models/SalaryRevision');
const { computeAnchorDate, get11MonthDate, internReviewDate } = require('../../utils/salaryRevisionDueDate');
const sendSalaryRevisionManagerRequest = require('./sendSalaryRevisionManagerRequest');
const { rescoreSalaryRevision } = require('../../utils/salaryRevisionScoring');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);
const OPEN_STAGES = ['pending_manager', 'pending_management', 'pending_hr', 'on_hold'];

// Daily cron — auto-creates a SalaryRevision (and fires Mail 1 through it)
// for any active employee whose Reminder Date (due date minus 1 month —
// see get11MonthDate) falls within the CURRENT calendar month, up to and
// including today, and who doesn't already have an open revision.
//
// Deliberately bounded to "this calendar month" rather than "any reminder
// date in the past, however old" — a dry run on 2026-09-02 found 26
// employees whose reminder date had already passed, some by over 6 years
// (predating this tracking system entirely). Blasting reporting managers
// with "your employee's review was due in 2020" the moment this went live
// would read as broken, not as a real HR process — explicitly scoped down
// to the current month per instruction. Each new calendar month naturally
// becomes its own fresh window; nothing from an earlier month is ever
// caught up automatically by this cron.
async function sendSalaryRevisionAutoTrigger(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
  const createdFor = [];
  const failures = [];

  for (const e of active) {
    const revisions = revisionsByEmployee.get(String(e._id)) || [];
    if (revisions.some((r) => OPEN_STAGES.includes(r.stage))) continue;

    let reminderDate;
    if (e.employeeCategory === 'Intern') {
      if (!e.contractPeriod) continue;
      reminderDate = internReviewDate(e.joinedDate, e.contractPeriod);
    } else {
      const anchor = computeAnchorDate(e.joinedDate, revisions);
      reminderDate = get11MonthDate(anchor);
    }

    if (reminderDate < monthStart || reminderDate > todayEnd) continue;

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
      createdFor.push(e.name);
    } catch (err) {
      console.error(`[sendSalaryRevisionAutoTrigger] Failed for ${e.name}:`, err.message);
      failures.push({ name: e.name, error: err.message });
    }
  }

  return { createdCount, createdFor, failures };
}

module.exports = sendSalaryRevisionAutoTrigger;
