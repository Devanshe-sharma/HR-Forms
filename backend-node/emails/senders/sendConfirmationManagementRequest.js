const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const { buildConfirmationActionLink } = require('../../utils/confirmationMailSigning');
const confirmationManagementRequestTemplate = require('../templates/confirmationManagementRequestTemplate');

const RECIPIENT = process.env.EMAIL_MANAGEMENT;

// Mail 2 — called the moment the reporting manager submits their
// recommendation (PUT /:id/manager or the public mail-action route,
// stage -> 'pending_management'). Queues a draft — does NOT send.
async function sendConfirmationManagementRequest(record) {
  const { subject, html } = confirmationManagementRequestTemplate({
    employeeName: record.employeeName,
    designation: record.designation,
    department: record.department,
    joiningDate: record.joiningDate,
    managerRecommendation: record.managerDecision?.status,
    actionLink: buildConfirmationActionLink(record._id, 'management'),
  });

  await queueConfirmationMail({
    confirmationId: record._id, mailType: 'managementRequest', employeeName: record.employeeName,
    to: RECIPIENT, subject, html,
  });
}

module.exports = sendConfirmationManagementRequest;
