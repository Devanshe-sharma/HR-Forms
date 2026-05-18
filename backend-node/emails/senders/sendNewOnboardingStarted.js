const { sendMail } = require("../mailer");
const template    = require("../templates/newOnboardingStarted");

async function sendNewOnboardingStarted(doc) {
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.HR_EMAIL,
    cc:      doc.employeesInCc?.join(",") || "",
    subject, html,
  });
}

module.exports = sendNewOnboardingStarted;