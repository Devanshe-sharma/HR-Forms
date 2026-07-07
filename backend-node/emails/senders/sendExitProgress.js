const sendEmail = require("../utils/sendEmail");
const exitProgressTemplate = require("../templates/exitProgressTemplate");
const buildExitCcList = require("../utils/buildExitCcList");

async function sendExitProgress(doc) {
  const { subject, html } = exitProgressTemplate(doc);
  const cc = buildExitCcList(doc);
  await sendEmail({
    to: process.env.HR_NOTIFICATION_EMAIL || "hr.head@briskolive.com",
    subject,
    html,
    cc,
  });
}

module.exports = sendExitProgress;
