const transporter = require("../mailer");
const template    = require("../templates/onboardingUpdate");

async function sendOnboardingUpdate(doc) {
  const { subject, html } = template(doc);
  await transporter.sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.HR_EMAIL,
    cc:      doc.employeesInCc?.join(",") || "",
    subject, html,
  });
}

module.exports = sendOnboardingUpdate;