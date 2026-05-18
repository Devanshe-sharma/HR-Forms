const transporter = require("../mailer");
const template    = require("../templates/reminder");

async function sendReminderEmail(doc) {
  if (!doc.persEmail) return;
  const { subject, html } = template(doc);
  await transporter.sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      doc.persEmail,
    subject, html,
  });
}

module.exports = sendReminderEmail;