const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../utils/sendEmail");
const exitInstructionsToAllTemplate = require("../templates/exitInstructionsToAllTemplate");

async function sendExitInstructionsToAll(doc) {
  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitInstructionsToAllTemplate(doc, dateStr);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitInstructionsToAll;
