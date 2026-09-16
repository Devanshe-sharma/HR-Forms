const Onboarding = require('../../models/onboardingModel');
const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const confirmationDueTemplate = require('../templates/confirmationDueTemplate');
const { expectedConfirmationDate } = require('../../utils/confirmationDueDate');
const {
  fiscalYearOf, fiscalQuarterOf, fiscalQuarterStart, fiscalQuarterEnd, fiscalYearLabel,
} = require('../../utils/fiscalQuarter');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

const RECIPIENT = process.env.EMAIL_MANAGEMENT;
const HR_HEAD_CC = process.env.HR_HEAD_EMAIL || 'hr.head@briskolive.com';

// Quarterly digest — every active employee whose probation confirmation
// date (joining + the standard 6-month probation) falls in the current
// fiscal quarter. Mirrors sendSalaryRevisionDue.js exactly. Queues a
// draft — does NOT send.
async function sendConfirmationDue(now = new Date()) {
  const fy = fiscalYearOf(now);
  const quarter = fiscalQuarterOf(now);
  const rangeStart = fiscalQuarterStart(fy, quarter);
  const rangeEnd = fiscalQuarterEnd(fy, quarter);
  const quarterLabel = `Q${quarter} ${fiscalYearLabel(fy)}`;

  const employees = await Onboarding.find({ joiningStatus: 'Joined' })
    .select('name dept designation joinedDate exitStatus').lean();
  const active = employees.filter((e) => !EXITED_STATUS_VALUES.has(e.exitStatus || '') && e.joinedDate);

  const rows = active
    .map((e) => {
      const confirmationDate = expectedConfirmationDate(e.joinedDate);
      if (confirmationDate < rangeStart || confirmationDate > rangeEnd) return null;
      return {
        name: e.name,
        department: e.dept,
        designation: e.designation,
        joiningDate: e.joinedDate,
        confirmationDate,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.confirmationDate - b.confirmationDate);

  const { subject, html } = confirmationDueTemplate(rows, quarterLabel);

  await queueConfirmationMail({
    mailType: 'quarterlyDigest', employeeName: `${rows.length} employees — ${quarterLabel}`,
    to: RECIPIENT, cc: HR_HEAD_CC, subject, html,
  });

  return { dueCount: rows.length };
}

module.exports = sendConfirmationDue;
