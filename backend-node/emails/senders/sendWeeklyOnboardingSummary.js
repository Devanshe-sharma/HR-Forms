const Onboarding = require("../../models/onboardingModel");
const sendEmail = require("../sendEmail");
const weeklyOnboardingTemplate = require("../triggers/triggerWeeklyOnboardingEmail");

async function sendWeeklyOnboardingSummary() {
  const openDocs = await Onboarding.find({ fmsStatus: "Open" }).sort({ fmsScore: 1 }).lean();

  const { subject, html } = weeklyOnboardingTemplate(openDocs);

  const to = process.env.HR_EMAIL || "hr.manager@briskolive.com";
  const cc = process.env.DEFAULT_CC_EMAILS || "";

  await sendEmail({ to, subject, html, cc });

  return { openCount: openDocs.length };
}

module.exports = sendWeeklyOnboardingSummary;
