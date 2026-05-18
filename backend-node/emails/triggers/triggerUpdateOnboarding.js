const sendNotJoining                     = require("../senders/sendNotJoining");
const sendOnboardingUpdate               = require("../senders/sendOnboardingUpdate");
const sendWelcomeEmail                   = require("../senders/sendWelcomeEmail");
const sendWelcomeEmailAlreadyJoined      = require("../senders/sendWelcomeEmailAlreadyJoined");
const sendReminderEmail                  = require("../senders/sendReminderEmail");
const sendInstructionsToAll              = require("../senders/sendInstructionsToAll");
const sendInstructionsToAllAlreadyJoined = require("../senders/sendInstructionsToAllAlreadyJoined");
const sendEmployeeFeedback               = require("../senders/sendEmployeeFeedback");

async function triggerUpdateOnboarding(doc) {
  try {
    // 9. Not Joining — send closure email and stop
    if (doc.joiningStatus === "Not Joining") {
      await sendNotJoining(doc);
      return;
    }

    // 10. Main HR update email — always sent
    await sendOnboardingUpdate(doc);

    // 11 & 12. Welcome email
    if (doc.autoWelcomeEmail) {
      if (doc.joiningStatus === "Yet To Join Office") {
        await sendWelcomeEmail(doc);
      } else if (doc.joiningStatus === "Joined") {
        await sendWelcomeEmailAlreadyJoined(doc);
      }
    }

    // 13. Reminder email
    if (doc.autoReminderEmail) {
      await sendReminderEmail(doc);
    }

    // 14 & 15. Instructions to all
    if (doc.autoInstructionsToAllEmail) {
      if (doc.joiningStatus === "Yet To Join Office") {
        await sendInstructionsToAll(doc);
      } else if (doc.joiningStatus === "Joined") {
        await sendInstructionsToAllAlreadyJoined(doc);
      }
    }

    // Employee feedback
    if (doc.employeeConfirmationEmail) {
      await sendEmployeeFeedback(doc);
    }

  } catch (err) {
    console.error("[triggerUpdateOnboarding] Email error:", err.message);
  }
}

module.exports = triggerUpdateOnboarding;