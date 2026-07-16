const sendEmail = require("../sendEmail");
const exitProgressTemplate = require("../templates/exitProgressTemplate");

async function sendExitProgress(doc) {
  const { subject, html } = exitProgressTemplate(doc);

  // Goes to HR / whoever's tracking the exit — previously this used
  // employeesInCc as the primary recipient, only falling back to HR
  // when that list happened to be empty (rarely the case in practice).
  const to = process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitProgress;