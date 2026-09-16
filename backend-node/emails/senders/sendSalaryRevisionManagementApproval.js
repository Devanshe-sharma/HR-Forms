const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const salaryRevisionManagementApprovalTemplate = require('../templates/salaryRevisionManagementApprovalTemplate');

// Live as of 2026-09-02.
const RECIPIENT = process.env.EMAIL_MANAGEMENT;

// Mail 2 — call right after PUT /:id/manager succeeds (stage ->
// 'pending_management'). Queues a draft — does NOT send.
async function sendSalaryRevisionManagementApproval(revision) {
  const manager = await resolveManagerContact(revision);

  const { subject, html } = salaryRevisionManagementApprovalTemplate({
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    currentCtc: revision.previousCtc,
    managerName: manager.name,
    managerDecision: revision.managerDecision,
    actionLink: buildSalaryRevisionActionLink(revision._id, 'management'),
  });

  await queueSalaryRevisionMail({
    revisionId: revision._id, mailType: 'managementApproval', employeeName: revision.employeeName,
    to: RECIPIENT, subject, html,
  });
}

module.exports = sendSalaryRevisionManagementApproval;
