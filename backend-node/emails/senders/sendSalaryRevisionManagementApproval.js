const sendEmail = require('../sendEmail');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const salaryRevisionManagementApprovalTemplate = require('../templates/salaryRevisionManagementApprovalTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to process.env.EMAIL_MANAGEMENT is approved.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 2 — call right after PUT /:id/manager succeeds (stage ->
// 'pending_management').
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

  await sendEmail({ to: RECIPIENT, subject, html });
}

module.exports = sendSalaryRevisionManagementApproval;
