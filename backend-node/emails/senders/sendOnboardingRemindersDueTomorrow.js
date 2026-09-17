const moment = require("moment-timezone");
const Onboarding = require("../../models/onboardingModel");
const sendReminderEmail = require("./sendReminderEmail");

const TZ = "Asia/Kolkata";

// Finds onboarding records whose plannedJoiningDate is tomorrow (IST) and
// sends the reminder email exactly once per record. Ticking the "Auto
// Reminder Email" checkbox (routes/onboardingroutes.js, resolveOneTimeEmails)
// no longer sends anything by itself — it only opts the record in. This
// sweep is what actually fires the email, and it stamps
// autoReminderEmailSentAt itself so a record already sent is never picked
// up again by a later run.
async function sendOnboardingRemindersDueTomorrow() {
  const tomorrowStart = moment().tz(TZ).add(1, "day").startOf("day").toDate();
  const tomorrowEnd = moment().tz(TZ).add(1, "day").endOf("day").toDate();

  const dueDocs = await Onboarding.find({
    autoReminderEmail: true,
    autoReminderEmailSentAt: { $in: [null, undefined] },
    joiningStatus: "Yet To Join Office",
    plannedJoiningDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
  });

  let sentCount = 0;
  for (const doc of dueDocs) {
    try {
      await sendReminderEmail(doc);
      await Onboarding.updateOne(
        { _id: doc._id },
        { $set: { autoReminderEmailSentAt: new Date() } }
      );
      sentCount++;
    } catch (err) {
      console.error(
        `[sendOnboardingRemindersDueTomorrow] Failed for ${doc?.name || doc?._id}:`,
        err.message
      );
    }
  }

  return { sentCount };
}

module.exports = sendOnboardingRemindersDueTomorrow;
