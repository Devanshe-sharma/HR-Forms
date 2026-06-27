const { sendMail } = require("../mailer");
const template      = require("../templates/newCandidateApplication");

async function sendNewCandidateApplicationToHR(doc) {
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.HR_EMAIL,
    subject, html,
  });
}

module.exports = sendNewCandidateApplicationToHR;
