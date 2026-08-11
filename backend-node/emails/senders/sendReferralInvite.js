// sendReferralInvite.js
const { sendMail } = require("../mailer");
const template     = require("../templates/referralInvite");
const buildCc      = require("../../utils/buildCc");

async function sendReferralInvite(doc) {
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.ALL_EMAIL,
    cc:      buildCc(doc, process.env.ALL_EMAIL),
    subject, html,
  });
}

module.exports = sendReferralInvite;
