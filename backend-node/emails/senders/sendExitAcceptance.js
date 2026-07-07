const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../utils/sendEmail");
const exitAcceptanceTemplate = require("../templates/exitAcceptanceTemplate");
const buildExitCcList = require("../utils/buildExitCcList");

async function sendExitAcceptance(doc) {
  const primaryEmail =
    (doc.persEmail && doc.persEmail.trim()) ||
    (doc.officialEmail && doc.officialEmail.trim()) ||
    "";
  if (!primaryEmail) return;

  const plannedExitDateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitAcceptanceTemplate(doc, plannedExitDateStr);
  const cc = buildExitCcList(doc);

  await sendEmail({ to: primaryEmail, subject, html, cc });
}

module.exports = sendExitAcceptance;
