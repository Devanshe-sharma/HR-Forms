const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitAcceptanceTemplate = require("../templates/exitAcceptanceTemplate");

async function sendExitAcceptance(doc) {
  const plannedExitDateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitAcceptanceTemplate(doc, plannedExitDateStr);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptance;
