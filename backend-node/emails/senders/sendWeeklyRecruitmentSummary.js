const HiringRequisition = require("../../models/HiringRequisition");
const sendEmail = require("../sendEmail");
const weeklyRecruitmentSummaryTemplate = require("../templates/weeklyRecruitmentSummaryTemplate");

async function sendWeeklyRecruitmentSummary() {
  const openRequisitions = await HiringRequisition.find({ fmsStatus: "Open" })
    .sort({ fms_score: 1 })
    .lean();

  const { subject, html } = weeklyRecruitmentSummaryTemplate(openRequisitions);

  const to = process.env.HR_EMAIL || "hr.manager@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";

  await sendEmail({ to, subject, html, cc });

  return { openCount: openRequisitions.length };
}

module.exports = sendWeeklyRecruitmentSummary;
