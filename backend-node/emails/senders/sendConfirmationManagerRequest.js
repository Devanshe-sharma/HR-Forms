const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const resolveConfirmationManagerContact = require('../../utils/resolveConfirmationManagerContact');
const { buildConfirmationActionLink } = require('../../utils/confirmationMailSigning');
const confirmationManagerRequestTemplate = require('../templates/confirmationManagerRequestTemplate');

const HR_FALLBACK = process.env.HR_EMAIL || 'hr.manager@briskolive.com';
const CC_MANAGEMENT = process.env.EMAIL_MANAGEMENT || '';

// Mail 1 — called the moment a confirmation review opens (advanceStageIfDue
// in routes/confirmations.js, stage 'not_due' -> 'pending_manager', at 5
// months' tenure — 1 month before the standard 6-month confirmation date).
// Queues a draft — does NOT send. Only ever fires for a FIRST transition
// into pending_manager from here on; never retroactively for a record
// that was already sitting there before this mail system existed.
async function sendConfirmationManagerRequest(record) {
  const manager = await resolveConfirmationManagerContact(record);
  const to = manager.email || HR_FALLBACK;

  const { subject, html } = confirmationManagerRequestTemplate({
    managerName: manager.name,
    employeeName: record.employeeName,
    designation: record.designation,
    department: record.department,
    joiningDate: record.joiningDate,
    actionLink: buildConfirmationActionLink(record._id, 'manager'),
  });

  await queueConfirmationMail({
    confirmationId: record._id, mailType: 'managerRequest', employeeName: record.employeeName,
    to, cc: manager.email ? CC_MANAGEMENT : '', subject, html,
  });
}

module.exports = sendConfirmationManagerRequest;
