const ConfirmationMailDraft = require('../models/ConfirmationMailDraft');

// Called by every Confirmation mail sender INSTEAD OF emails/sendEmail —
// mirrors utils/salaryRevisionMailQueue.js exactly. It's saved as an
// editable draft; only HR sending it from the dashboard actually calls
// sendEmail (see routes/confirmationMailDrafts.js).
async function queueConfirmationMail({ confirmationId, mailType, employeeName, to, cc, bcc, subject, html }) {
  return ConfirmationMailDraft.create({
    confirmationId: confirmationId || null,
    mailType,
    employeeName: employeeName || '',
    to,
    cc: cc || '',
    bcc: bcc || '',
    subject,
    html,
  });
}

module.exports = { queueConfirmationMail };
