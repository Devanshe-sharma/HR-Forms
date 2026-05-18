const transporter = require("../mailer");
const template    = require("../templates/instructionsToAllAlreadyJoined");

async function sendInstructionsToAllAlreadyJoined(doc) {
  const { subject, html } = template(doc);
  await transporter.sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.ALL_EMAIL,
    subject, html,
  });
}

module.exports = sendInstructionsToAllAlreadyJoined;