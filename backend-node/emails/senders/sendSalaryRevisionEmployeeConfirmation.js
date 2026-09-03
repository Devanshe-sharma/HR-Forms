const sendEmail = require('../sendEmail');
const salaryRevisionEmployeeConfirmationTemplate = require('../templates/salaryRevisionEmployeeConfirmationTemplate');

// Mail 3 — call right after PUT /:id/hr succeeds (stage -> 'completed'),
// increment path only (mgrDecision.decision === 'increment'). Live as of
// 2026-09-02 — sends to the employee's own email on file.
async function sendSalaryRevisionEmployeeConfirmation(revision) {
  if (!revision.email) {
    console.error(`[sendSalaryRevisionEmployeeConfirmation] No email on file for revision ${revision._id} (employee: ${revision.employeeName}) — mail not sent.`);
    return;
  }

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

  await sendEmail({ to: revision.email, subject, html });
}

module.exports = sendSalaryRevisionEmployeeConfirmation;
