// sendReferralSubmittedToHR.js
const { sendMail } = require("../mailer");
const template     = require("../templates/referralSubmitted");

async function sendReferralSubmittedToHR(doc) {
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      [process.env.HR_EMAIL, process.env.HR_HEAD_EMAIL].filter(Boolean).join(','),
    subject, html,
  });
}

module.exports = sendReferralSubmittedToHR;
