const sendEmail = require("../sendEmail");
const exitProgressTemplate = require("../templates/exitProgressTemplate");

async function sendExitProgress(doc) {
  const { subject, html } = exitProgressTemplate(doc);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitProgress;
