const { sendMail } = require("../mailer");
const template    = require("../templates/welcomeAlreadyJoined");

async function sendWelcomeEmailAlreadyJoined(doc) {
  if (!doc.persEmail) return;
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      doc.persEmail,
    subject, html,
  });
}

module.exports = sendWelcomeEmailAlreadyJoined;