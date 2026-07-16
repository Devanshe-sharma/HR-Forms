const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitInstructionsToAllAlreadyTemplate = require("../templates/exitInstructionsToAllAlreadyTemplate");

async function sendExitInstructionsToAllAlready(doc) {
  const dateStr = dateToDD_MMM_YY(doc.leftDate);
  const { subject, html } = exitInstructionsToAllAlreadyTemplate(doc, dateStr);

  // Company-wide notice — same fix as sendExitInstructionsToAll.
  const to = process.env.ALL_EMPLOYEES_EMAIL || "all@briskolive.com";
  const cc = (doc.employeesInCc || []).filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitInstructionsToAllAlready;