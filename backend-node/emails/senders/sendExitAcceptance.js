const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const exitAcceptanceTemplate = require("../templates/exitAcceptanceTemplate");

async function sendExitAcceptance(doc) {
  const plannedExitDateStr = dateToDD_MMM_YY(doc.plannedExitDate);
  const { subject, html } = exitAcceptanceTemplate(doc, plannedExitDateStr);

  // Goes to the departing employee themselves — previously this sent to
  // whoever was in employeesInCc instead (e.g. the buddy), so the
  // employee never actually received their own exit acceptance notice.
  const to = doc.officialEmail || doc.persEmail || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptance;