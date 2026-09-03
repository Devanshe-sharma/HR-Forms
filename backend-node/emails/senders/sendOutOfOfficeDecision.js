const { sendMail } = require('../mailer');
const template = require('../templates/outOfOfficeDecisionTemplate');

// Notifies whoever logged the request (and the person it's for, if
// different) once the manager has approved/rejected it. Cc's HR the same
// way the original notice does, so the thread stays visible to them too.
async function sendOutOfOfficeDecision(doc) {
  const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { subject, html } = template(plainDoc);

  const to = plainDoc.submittedByEmail || plainDoc.person.email;
  const cc = [plainDoc.person.email, process.env.HR_HEAD_EMAIL]
    .filter(Boolean)
    .filter((email) => email.toLowerCase() !== String(to).toLowerCase());

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    cc: cc.join(','),
    subject,
    html,
  });
}

module.exports = sendOutOfOfficeDecision;
