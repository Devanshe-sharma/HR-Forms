const sendNotJoining                     = require("../senders/sendNotJoining");
const sendOnboardingUpdate               = require("../senders/sendOnboardingUpdate");
const sendWelcomeEmail                   = require("../senders/sendWelcomeEmail");
const sendWelcomeEmailAlreadyJoined      = require("../senders/sendWelcomeEmailAlreadyJoined");
const sendReminderEmail                  = require("../senders/sendReminderEmail");
const sendInstructionsToAll              = require("../senders/sendInstructionsToAll");
const sendInstructionsToAllAlreadyJoined = require("../senders/sendInstructionsToAllAlreadyJoined");
const sendEmployeeFeedback               = require("../senders/sendEmployeeFeedback");

// previousDoc is the record's state BEFORE this update was saved — needed
// to tell "this flag just became true in THIS save" apart from "this flag
// has been true since some earlier update and is just staying true
// forever" (which is correct/intentional for the *checklist* marking,
// via resolveOneTimeEmails in the routes file, but was never meant to
// mean "re-send this email on every future update too").
async function triggerUpdateOnboarding(doc, previousDoc) {
  try {
    // Not Joining — send closure email and stop
    if (doc.joiningStatus === "Not Joining") {
      await sendNotJoining(doc);
      return;
    }

    // Main HR update email — genuinely always sent on every update,
    // unlike the four below.
    await sendOnboardingUpdate(doc);

    // A one-time email only actually fires here if THIS specific save is
    // the one that just set its *SentAt timestamp — comparing against
    // previousDoc's timestamp for the same field, not just checking the
    // current boolean flag (which stays permanently true forever once
    // ever sent, by design). Without this comparison, every future
    // update for any reason at all would re-fire every email that was
    // ever checked in the past, which is exactly the bug being fixed.
    const isNewlySent = (sentAtField) => {
      const prevSentAt = previousDoc?.[sentAtField];
      const newSentAt  = doc?.[sentAtField];
      if (!newSentAt) return false;
      if (!prevSentAt) return true;
      return new Date(prevSentAt).getTime() !== new Date(newSentAt).getTime();
    };

    // Welcome email
    if (doc.autoWelcomeEmail && isNewlySent("autoWelcomeEmailSentAt")) {
      if (doc.joiningStatus === "Yet To Join Office") {
        await sendWelcomeEmail(doc);
      } else if (doc.joiningStatus === "Joined") {
        await sendWelcomeEmailAlreadyJoined(doc);
      }
    }

    // Reminder email
    if (doc.autoReminderEmail && isNewlySent("autoReminderEmailSentAt")) {
      await sendReminderEmail(doc);
    }

    // Instructions to all
    if (doc.autoInstructionsToAllEmail && isNewlySent("autoInstructionsToAllEmailSentAt")) {
      if (doc.joiningStatus === "Yet To Join Office") {
        await sendInstructionsToAll(doc);
      } else if (doc.joiningStatus === "Joined") {
        await sendInstructionsToAllAlreadyJoined(doc);
      }
    }

    // Employee feedback
    if (doc.employeeConfirmationEmail && isNewlySent("employeeConfirmationEmailSentAt")) {
      await sendEmployeeFeedback(doc);
    }

  } catch (err) {
    console.error("[triggerUpdateOnboarding] Email error:", err.message);
  }
}

module.exports = triggerUpdateOnboarding;