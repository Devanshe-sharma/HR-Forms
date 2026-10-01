const Onboarding = require('../../models/onboardingModel');
const SalaryRevision = require('../../models/SalaryRevision');
const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const salaryRevisionDueTemplate = require('../templates/salaryRevisionDueTemplate');
const { dueDateInRange, doneDateFor } = require('../../utils/salaryRevisionDueDate');
const { resolveManagerEmailByName } = require('../../utils/resolveManagerContact');
const {
  fiscalYearOf, fiscalQuarterOf, fiscalQuarterStart, fiscalQuarterEnd, fiscalYearLabel,
} = require('../../utils/fiscalQuarter');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// Live as of 2026-09-02.
const RECIPIENT = process.env.EMAIL_MANAGEMENT;
const HR_HEAD_CC = process.env.HR_HEAD_EMAIL || 'hr.head@briskolive.com';

async function sendSalaryRevisionDue(now = new Date()) {
  const fy = fiscalYearOf(now);
  const quarter = fiscalQuarterOf(now);
  const rangeStart = fiscalQuarterStart(fy, quarter);
  const rangeEnd = fiscalQuarterEnd(fy, quarter);
  const quarterLabel = `Q${quarter} ${fiscalYearLabel(fy)}`;

  const employees = await Onboarding.find({ joiningStatus: 'Joined' })
    .select('name dept designation joinedDate employeeCategory contractPeriod exitStatus reportingHead')
    .lean();

  const active = employees.filter((e) => !EXITED_STATUS_VALUES.has(e.exitStatus || ''));

  const revisionsByEmployee = new Map();
  const allRevisions = await SalaryRevision.find({
    employeeCode: { $in: active.map((e) => String(e._id)) },
  }).select('employeeCode stage applicableDate createdAt fullTimeSince').lean();
  allRevisions.forEach((r) => {
    const key = r.employeeCode;
    if (!revisionsByEmployee.has(key)) revisionsByEmployee.set(key, []);
    revisionsByEmployee.get(key).push(r);
  });

  const rows = active
    .map((e) => {
      const employee = {
        joiningDate: e.joinedDate,
        employeeCategory: e.employeeCategory,
        contractPeriod: e.contractPeriod,
      };
      const revisions = revisionsByEmployee.get(String(e._id)) || [];
      const dueDate = dueDateInRange(employee, revisions, rangeStart, rangeEnd);
      if (!dueDate) return null;

      return {
        name: e.name,
        department: e.dept,
        designation: e.designation,
        joiningDate: e.joinedDate,
        doneDate: doneDateFor(dueDate),
        dueDate,
        reportingHead: e.reportingHead || '',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dueDate - b.dueDate);

  const { subject, html } = salaryRevisionDueTemplate(rows, quarterLabel);

  await queueSalaryRevisionMail({
    mailType: 'quarterlyDigest', employeeName: `${rows.length} employees — ${quarterLabel}`,
    to: RECIPIENT, cc: HR_HEAD_CC, subject, html,
  });

  // One additional digest PER MANAGER, each listing only their own direct
  // reports who are due — on request, alongside the existing Management-
  // wide digest above (which still goes out unchanged). Grouped by
  // reportingHead's resolved email rather than its raw name text, since
  // the same manager can be spelled/cased slightly differently across
  // records and would otherwise split into separate (and separately
  // mailed) groups.
  const byManagerEmail = new Map();
  for (const row of rows) {
    if (!row.reportingHead) continue;
    const manager = await resolveManagerEmailByName(row.reportingHead, row.department);
    if (!manager.email) continue;
    if (!byManagerEmail.has(manager.email)) byManagerEmail.set(manager.email, { name: manager.name, rows: [] });
    byManagerEmail.get(manager.email).rows.push(row);
  }

  let managerDigestCount = 0;
  for (const [managerEmail, { name: managerName, rows: managerRows }] of byManagerEmail) {
    const managerTemplate = salaryRevisionDueTemplate(managerRows, quarterLabel, managerName);
    await queueSalaryRevisionMail({
      mailType: 'quarterlyDigest',
      employeeName: `${managerRows.length} direct report(s) — ${managerName} — ${quarterLabel}`,
      to: managerEmail, cc: HR_HEAD_CC, subject: managerTemplate.subject, html: managerTemplate.html,
    });
    managerDigestCount++;
  }

  return { dueCount: rows.length, managerDigestCount };
}

module.exports = sendSalaryRevisionDue;
