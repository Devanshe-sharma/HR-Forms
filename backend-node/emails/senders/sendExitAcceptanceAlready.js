const sendEmail = require("../utils/sendEmail");
const exitAcceptanceAlreadyTemplate = require("../templates/exitAcceptanceAlreadyTemplate");
const buildExitCcList = require("../utils/buildExitCcList");

async function sendExitAcceptanceAlready(doc) {
  const primaryEmail =
    (doc.persEmail && doc.persEmail.trim()) ||
    (doc.officialEmail && doc.officialEmail.trim()) ||
    "";
  if (!primaryEmail) return;

  const { subject, html } = exitAcceptanceAlreadyTemplate(doc);
  const cc = buildExitCcList(doc);

  await sendEmail({ to: primaryEmail, subject, html, cc });
}

module.exports = sendExitAcceptanceAlready;
