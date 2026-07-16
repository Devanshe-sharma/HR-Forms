const sendEmail = require("../sendEmail");
const exitAcceptanceAlreadyTemplate = require("../templates/exitAcceptanceAlreadyTemplate");

async function sendExitAcceptanceAlready(doc) {
  const { subject, html } = exitAcceptanceAlreadyTemplate(doc);

  // Goes to HR / whoever's tracking the exit — same fix as
  // sendExitProgress.
  const to = process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptanceAlready;