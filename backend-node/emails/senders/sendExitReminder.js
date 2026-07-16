const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitReminderTemplate = require("../templates/exitReminderTemplate");

async function sendExitReminder(doc) {
  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate || doc.leftDate);
  const { subject, html } = exitReminderTemplate(doc, dateStr);

  // Goes to the departing employee — same fix as sendExitAcceptance.
  const to = doc.officialEmail || doc.persEmail || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitReminder;