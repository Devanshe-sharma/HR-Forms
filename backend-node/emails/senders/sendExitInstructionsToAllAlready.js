const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitInstructionsToAllAlreadyTemplate = require("../templates/exitInstructionsToAllAlreadyTemplate");

async function sendExitInstructionsToAllAlready(doc) {
  const dateStr = dateToDD_MMM_YY(doc.leftDate);
  const { subject, html } = exitInstructionsToAllAlreadyTemplate(doc, dateStr);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitInstructionsToAllAlready;
