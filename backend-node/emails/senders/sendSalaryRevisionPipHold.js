const sendEmail = require('../sendEmail');
const salaryRevisionPipHoldTemplate = require('../templates/salaryRevisionPipHoldTemplate');

// Mail 4 — call right after PUT /:id/management succeeds with
// managementDecision.pipApproved === true (stage -> 'on_hold'). Live as of
// 2026-09-02 — sends to the employee's own email on file.
async function sendSalaryRevisionPipHold(revision) {
  if (!revision.email) {
    console.error(`[sendSalaryRevisionPipHold] No email on file for revision ${revision._id} (employee: ${revision.employeeName}) — mail not sent.`);
    return;
  }

  const { subject, html } = salaryRevisionPipHoldTemplate({
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    currentCtc: revision.previousCtc,
    pipStartDate: revision.managementDecision?.submittedAt || new Date(),
    pipReviewDate: revision.reviewDate,
  });

  await sendEmail({ to: revision.email, subject, html });
}

module.exports = sendSalaryRevisionPipHold;
