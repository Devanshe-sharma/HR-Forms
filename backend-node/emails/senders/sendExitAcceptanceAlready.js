const sendEmail = require("../sendEmail");
const exitAcceptanceAlreadyTemplate = require("../templates/exitAcceptanceAlreadyTemplate");

async function sendExitAcceptanceAlready(doc) {
  const { subject, html } = exitAcceptanceAlreadyTemplate(doc);

  // Goes to the departing employee themselves — same fix as
  // sendExitAcceptance (the "Serving Notice Period" sibling of this exact
  // template): this is written as a personal letter to the employee
  // ("Dear <name>... please contact me"), but was sending to
  // HR_HEAD_EMAIL instead, so the employee never actually received it —
  // confirmed live: Sanya Pandey's exit-acceptance mail went to
  // hr.head/management/admin/accounts/hr.manager and never to her.
  const to = doc.officialEmail || doc.persEmail || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptanceAlready;