const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const sendEmail = require("../sendEmail");
const buildExitAcceptanceByType = require("../templates/exitAcceptanceByType");
const sendExitAcceptance = require("./sendExitAcceptance");
const sendExitAcceptanceAlready = require("./sendExitAcceptanceAlready");

// Replaces the exitStatus-only sendExitAcceptance/sendExitAcceptanceAlready
// choice with one keyed by exitType instead, wherever exitType is one of
// the 7 recognized values — falls back to the original exitStatus-based
// emails for anything else (blank exitType, or legacy free-text values
// that predate this), so nothing silently stops sending.
async function sendExitAcceptanceByType(doc) {
  const dateStr = dateToDD_MMM_YY(doc.leftDate || doc.plannedExitDate);
  const built = buildExitAcceptanceByType(doc, dateStr);

  if (!built) {
    if (doc.exitStatus === "Serving Notice Period") return sendExitAcceptance(doc);
    if (doc.exitStatus === "Already Left" || doc.exitStatus === "Left") return sendExitAcceptanceAlready(doc);
    return;
  }

  const { subject, html, addressedToTeam } = built;

  const ccList = [
    ...(doc.employeesInCc || []),
    ...(process.env.DEFAULT_CC_EMAILS ? process.env.DEFAULT_CC_EMAILS.split(",") : []),
  ];
  const cc = ccList.filter(Boolean).join(",");

  // Demise is addressed "Dear Team" — a notice about the employee, not to
  // them — so it goes to HR/internal rather than the employee's own inbox.
  const to = addressedToTeam
    ? (process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com")
    : (doc.officialEmail || doc.persEmail || process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com");

  await sendEmail({ to, subject, html, cc });
}

module.exports = sendExitAcceptanceByType;
