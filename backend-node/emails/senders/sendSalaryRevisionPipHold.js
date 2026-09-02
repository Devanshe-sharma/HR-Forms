const sendEmail = require('../sendEmail');
const salaryRevisionPipHoldTemplate = require('../templates/salaryRevisionPipHoldTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to the employee is approved.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 4 — call right after PUT /:id/management succeeds with
// managementDecision.pipApproved === true (stage -> 'on_hold').
async function sendSalaryRevisionPipHold(revision) {
  const { subject, html } = salaryRevisionPipHoldTemplate({
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    currentCtc: revision.previousCtc,
    pipStartDate: revision.managementDecision?.submittedAt || new Date(),
    pipReviewDate: revision.reviewDate,
  });

  await sendEmail({ to: RECIPIENT, subject, html });
}

module.exports = sendSalaryRevisionPipHold;
