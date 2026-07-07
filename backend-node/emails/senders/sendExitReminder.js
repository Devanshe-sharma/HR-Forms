const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../utils/sendEmail");
const exitReminderTemplate = require("../templates/exitReminderTemplate");
const buildExitCcList = require("../utils/buildExitCcList");

async function sendExitReminder(doc) {
  const primaryEmail =
    (doc.persEmail && doc.persEmail.trim()) ||
    (doc.officialEmail && doc.officialEmail.trim()) ||
    "";
  if (!primaryEmail) return;

  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate || doc.leftDate);
  const { subject, html } = exitReminderTemplate(doc, dateStr);
  const cc = buildExitCcList(doc);

  await sendEmail({ to: primaryEmail, subject, html, cc });
}

module.exports = sendExitReminder;
