const { sendMail } = require("../mailer");
const template    = require("../templates/newOnboardingStarted");
const buildCc = require("../../utils/buildCc");
async function sendNewOnboardingStarted(doc) {
const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.HR_EMAIL,
    cc:      buildCc(doc),
    subject, html,
  });
}

module.exports = sendNewOnboardingStarted;
