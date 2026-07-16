const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitInstructionsToAllTemplate = require("../templates/exitInstructionsToAllTemplate");

async function sendExitInstructionsToAll(doc) {
  const dateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitInstructionsToAllTemplate(doc, dateStr);

  // Company-wide notice — matches the old Apps Script's own
  // sendInstructionsToAll(), which always went to "all@briskolive.com"
  // regardless of anything else. Previously this incorrectly used
  // employeesInCc as the primary recipient instead of going company-wide.
  const to = process.env.ALL_EMPLOYEES_EMAIL || "all@briskolive.com";
  const cc = (doc.employeesInCc || []).filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitInstructionsToAll;