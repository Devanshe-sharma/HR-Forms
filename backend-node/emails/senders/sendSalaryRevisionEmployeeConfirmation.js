const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const salaryRevisionEmployeeConfirmationTemplate = require('../templates/salaryRevisionEmployeeConfirmationTemplate');

// Mail 3 — call right after PUT /:id/hr succeeds (stage -> 'completed'),
// increment path only (mgrDecision.decision === 'increment'). Queues a
// draft addressed to the employee's own email on file — does NOT send.
async function sendSalaryRevisionEmployeeConfirmation(revision) {
  if (!revision.email) {
    console.error(`[sendSalaryRevisionEmployeeConfirmation] No email on file for revision ${revision._id} (employee: ${revision.employeeName}) — no draft queued.`);
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

  await queueSalaryRevisionMail({
    revisionId: revision._id, mailType: 'employeeConfirmation', employeeName: revision.employeeName,
    to: revision.email, subject, html,
  });
}

module.exports = sendSalaryRevisionEmployeeConfirmation;
