const Exit = require("../../models/exitModel");
const sendEmail = require("../utils/sendEmail");
const weeklyExitSummaryTemplate = require("../templates/weeklyExitSummaryTemplate");

async function sendWeeklyExitSummary() {
  const openExits = await Exit.find({ fmsStatus: "Open" }).lean();
  const { subject, html } = weeklyExitSummaryTemplate(openExits);

  // Matches the original Apps Script's recipients exactly.
  await sendEmail({
    to: "hr.manager@briskolive.com,hr.head@briskolive.com",
    subject,
    html,
    cc: "software.developer@briskolive.com",
  });

  // Original script also sent a duplicate copy to the developer address
  // with a different cc — preserved here for parity.
  if (openExits.length > 0) {
    await sendEmail({
      to: "software.developer@briskolive.com",
      subject,
      html,
      cc: "da.automation@briskolive.com",
    });
  }

  return { openCount: openExits.length };
}

module.exports = sendWeeklyExitSummary;