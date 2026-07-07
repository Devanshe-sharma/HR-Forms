const Exit = require("../../models/exitModel");
const sendEmail = require("../utils/sendEmail");
const weeklyExitSummaryTemplate = require("../templates/weeklyExitSummaryTemplate");

async function sendWeeklyExitSummary() {
  const openExits = await Exit.find({ fmsStatus: "Open" }).lean();
  const { subject, html } = weeklyExitSummaryTemplate(openExits);

  const to = process.env.HR_HEAD_EMAIL || "hr.head@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";

  await sendEmail({ to, subject, html, cc });

  return { openCount: openExits.length };
}

module.exports = sendWeeklyExitSummary;
