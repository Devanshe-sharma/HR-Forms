const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../utils/sendEmail");
const exitInstructionsToAllTemplate = require("../templates/exitInstructionsToAllTemplate");

async function sendExitInstructionsToAll(doc) {
  const primaryEmail =
    (doc.persEmail && doc.persEmail.trim()) ||
    (doc.officialEmail && doc.officialEmail.trim()) ||
    "";

  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitInstructionsToAllTemplate(doc, dateStr);

  await sendEmail({
    to: process.env.EXIT_INTERNAL_NOTIFY_EMAIL || "software.developer@briskolive.com",
    subject,
    html,
    cc: primaryEmail,
  });
}

module.exports = sendExitInstructionsToAll;
