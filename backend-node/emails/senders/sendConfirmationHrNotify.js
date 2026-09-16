const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const confirmationHrNotifyTemplate = require('../templates/confirmationHrNotifyTemplate');

const RECIPIENT = process.env.HR_EMAIL || 'hr.manager@briskolive.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// Mail 3 — called the moment Management submits a final confirmed/
// not_confirmed decision (PUT /:id/management or the public mail-action
// route, stage -> 'pending_hr'). An 'extended' decision never reaches
// here — it goes straight to 'on_hold', nothing for HR to do until it
// reopens. Queues a draft — does NOT send.
//
// Unlike the manager/management mails, this one does NOT use a signed
// public action link — HR already has an authenticated account and logs
// into the dashboard to upload the document, same as the Salary
// Revision Mail Queue digest just links to the app rather than building
// a public upload form for an internal user.
async function sendConfirmationHrNotify(record) {
  const { subject, html } = confirmationHrNotifyTemplate({
    employeeName: record.employeeName,
    designation: record.designation,
    department: record.department,
    joiningDate: record.joiningDate,
    managementDecision: record.managementDecision?.status,
    actionLink: `${FRONTEND_URL}/confirmations`,
  });

  await queueConfirmationMail({
    confirmationId: record._id, mailType: 'hrNotify', employeeName: record.employeeName,
    to: RECIPIENT, subject, html,
  });
}

module.exports = sendConfirmationHrNotify;
