const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitReminderTemplate = require("../templates/exitReminderTemplate");

async function sendExitReminder(doc) {
  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate || doc.leftDate);
  const { subject, html } = exitReminderTemplate(doc, dateStr);
  const to = (doc.employeesInCc || []).join(",") || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";
  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitReminder;
