const { sendMail } = require('../mailer');
const template = require('../templates/outOfOfficeManagerApprovalTemplate');
const { buildOutOfOfficeActionLink } = require('../../utils/outOfOfficeMailSigning');

async function sendOutOfOfficeManagerApproval(doc) {
  if (!doc.manager?.email) {
    console.error('[sendOutOfOfficeManagerApproval] No manager email resolved — skipping approval mail for', doc._id);
    return;
  }

  const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { subject, html } = template({ ...plainDoc, actionLink: buildOutOfOfficeActionLink(doc._id) });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to: doc.manager.email,
    subject,
    html,
  });
}

module.exports = sendOutOfOfficeManagerApproval;
