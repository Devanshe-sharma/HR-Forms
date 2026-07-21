const { sendMail } = require("../mailer");
const template    = require("../templates/reminder");
const buildCc = require("../../utils/buildCc");

async function sendReminderEmail(doc) {
  // Goes to the employee awaiting joining — previously this sent to
  // process.env.HR_EMAIL instead, so the person the reminder is actually
  // addressed to ("I will be waiting for your joining...") never
  // received it at all.
  if (!doc.persEmail) return;

  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      doc.persEmail,
    cc:      buildCc(doc),
    subject, html,
  });
}

module.exports = sendReminderEmail;