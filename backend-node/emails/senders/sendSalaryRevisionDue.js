const Onboarding = require('../../models/onboardingModel');
const SalaryRevision = require('../../models/SalaryRevision');
const sendEmail = require('../sendEmail');
const salaryRevisionDueTemplate = require('../templates/salaryRevisionDueTemplate');
const { dueDateInRange, doneDateFor } = require('../../utils/salaryRevisionDueDate');
const {
  fiscalYearOf, fiscalQuarterOf, fiscalQuarterStart, fiscalQuarterEnd, fiscalYearLabel,
} = require('../../utils/fiscalQuarter');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// TODO: this digest is meant for Management (process.env.EMAIL_MANAGEMENT)
// but is routed to the developer only for now, per explicit instruction —
// switch RECIPIENT back to EMAIL_MANAGEMENT once the real send is approved.
const RECIPIENT = 'software.developer@briskolive.com';

async function sendSalaryRevisionDue(now = new Date()) {
  const fy = fiscalYearOf(now);
  const quarter = fiscalQuarterOf(now);
  const rangeStart = fiscalQuarterStart(fy, quarter);
  const rangeEnd = fiscalQuarterEnd(fy, quarter);
  const quarterLabel = `Q${quarter} ${fiscalYearLabel(fy)}`;

  const employees = await Onboarding.find({ joiningStatus: 'Joined' })
    .select('name dept designation joinedDate employeeCategory contractPeriod exitStatus')
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dueDate - b.dueDate);

  const { subject, html } = salaryRevisionDueTemplate(rows, quarterLabel);

  await sendEmail({ to: RECIPIENT, subject, html });

  return { dueCount: rows.length };
}

module.exports = sendSalaryRevisionDue;
