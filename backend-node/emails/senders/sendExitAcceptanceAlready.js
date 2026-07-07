const sendEmail = require("../utils/sendEmail");
const exitAcceptanceAlreadyTemplate = require("../templates/exitAcceptanceAlreadyTemplate");

async function sendExitAcceptanceAlready(doc) {
  const { subject, html } = exitAcceptanceAlreadyTemplate(doc);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptanceAlready;
