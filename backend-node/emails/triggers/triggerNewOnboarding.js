const sendNotJoining                   = require("../senders/sendNotJoining");
const sendNewOnboardingStarted         = require("../senders/sendNewOnboardingStarted");
const sendWelcomeEmail                 = require("../senders/sendWelcomeEmail");
const sendWelcomeEmailAlreadyJoined    = require("../senders/sendWelcomeEmailAlreadyJoined");
const sendReminderEmail                = require("../senders/sendReminderEmail");
const sendInstructionsToAll            = require("../senders/sendInstructionsToAll");
const sendInstructionsToAllAlreadyJoined = require("../senders/sendInstructionsToAllAlreadyJoined");
const sendEmployeeFeedback             = require("../senders/sendEmployeeFeedback");

async function triggerNewOnboarding(doc) {
  try {
    // 1. Not Joining — send closure email and stop
    if (doc.joiningStatus === "Not Joining") {
      await sendNotJoining(doc);
      return;
    }

    // 2. Main HR status email — always sent
    await sendNewOnboardingStarted(doc);

    // 3 & 4. Welcome email to joinee
    if (doc.joiningStatus === "Yet To Join Office") {
      await sendWelcomeEmail(doc);
    } else if (doc.joiningStatus === "Joined") {
      await sendWelcomeEmailAlreadyJoined(doc);
    }

    // 5. Reminder email — if checkbox ticked
    if (doc.autoReminderEmail) {
      await sendReminderEmail(doc);
    }

    // 6 & 7. Instructions to all
    if (doc.autoInstructionsToAllEmail) {
      if (doc.joiningStatus === "Yet To Join Office") {
        await sendInstructionsToAll(doc);
      } else if (doc.joiningStatus === "Joined") {
        await sendInstructionsToAllAlreadyJoined(doc);
      }
    }

    // 8. Employee feedback form
    if (doc.employeeConfirmationEmail) {
      await sendEmployeeFeedback(doc);
    }

  } catch (err) {
    // Log but don't crash the request
    console.error("[triggerNewOnboarding] Email error:", err.message);
  }
}

module.exports = triggerNewOnboarding;