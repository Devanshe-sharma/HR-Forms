const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const salaryRevisionPipHoldTemplate = require('../templates/salaryRevisionPipHoldTemplate');

// Mail 4 — call right after PUT /:id/management succeeds with
// managementDecision.pipApproved === true (stage -> 'on_hold'). Queues a
// draft addressed to the employee's own email on file — does NOT send.
async function sendSalaryRevisionPipHold(revision) {
  if (!revision.email) {
    console.error(`[sendSalaryRevisionPipHold] No email on file for revision ${revision._id} (employee: ${revision.employeeName}) — no draft queued.`);
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

  await queueSalaryRevisionMail({
    revisionId: revision._id, mailType: 'pipHold', employeeName: revision.employeeName,
    to: revision.email, subject, html,
  });
}

module.exports = sendSalaryRevisionPipHold;
