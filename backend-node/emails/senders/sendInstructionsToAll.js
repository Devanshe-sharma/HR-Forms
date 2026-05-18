const { sendMail } = require("../mailer");
const template    = require("../templates/instructionsToAll");

async function sendInstructionsToAll(doc) {
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.ALL_EMAIL,
    subject, html,
  });
}

module.exports = sendInstructionsToAll;