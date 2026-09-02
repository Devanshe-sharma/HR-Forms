const sendEmail = require('../sendEmail');
const salaryRevisionEmployeeConfirmationTemplate = require('../templates/salaryRevisionEmployeeConfirmationTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to the employee is approved.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 3 — call right after PUT /:id/hr succeeds (stage -> 'completed'),
// increment path only (mgrDecision.decision === 'increment').
async function sendSalaryRevisionEmployeeConfirmation(revision) {
  const { subject, html } = salaryRevisionEmployeeConfirmationTemplate({
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    previousCtc: revision.previousCtc,
    incrementPct: revision.finalIncrementPct,
    newCtc: revision.newCtc,
    effectiveFrom: revision.applicableDate,
  });

  await sendEmail({ to: RECIPIENT, subject, html });
}

module.exports = sendSalaryRevisionEmployeeConfirmation;
