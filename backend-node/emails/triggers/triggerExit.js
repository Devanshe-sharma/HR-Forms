const sendExitProgress                  = require("../senders/sendExitProgress");
const sendExitAcceptance                = require("../senders/sendExitAcceptance");
const sendExitAcceptanceAlready         = require("../senders/sendExitAcceptanceAlready");
const sendExitReminder                  = require("../senders/sendExitReminder");
const sendExitInstructionsToAll         = require("../senders/sendExitInstructionsToAll");
const sendExitInstructionsToAllAlready  = require("../senders/sendExitInstructionsToAllAlready");

const EXIT_EMAILS_TEMPORARILY_DISABLED = true;

// NOTE on doc's auto-email fields (autoExitEmail, autoReminderEmail,
// autoInstructionsToAllEmail): the route handler is responsible for only
// setting these to true on the SPECIFIC call where the checkbox was newly
// ticked (via the sticky one-time-email pattern), and false otherwise -
// so this trigger never re-sends an email that already went out.
//
// "autoExitEmailDept" exists on the schema but isn't wired to anything
// here yet - its intended purpose wasn't clear from the source material.
// Tell us what it should trigger and we'll wire it up.
async function triggerNewExit(doc) {
  try {
    if (EXIT_EMAILS_TEMPORARILY_DISABLED) {
      console.log("[triggerNewExit] Exit emails temporarily disabled; skipping send.");
      return;
    }

    // Exit Cancelled - no progress/checklist email, matching the original
    // Apps Script's early-return behavior.
    if (doc.exitStatus === "Exit Cancelled") {
      return;
    }

    // Main status email - always sent on create/update.
    await sendExitProgress(doc);

    // Acceptance email to the employee themselves.
    if (doc.autoExitEmail) {
      if (doc.exitStatus === "Serving Notice Period") {
        await sendExitAcceptance(doc);
      } else if (doc.exitStatus === "Already Left" || doc.exitStatus === "Left") {
        await sendExitAcceptanceAlready(doc);
      }
    }

    // Reminder email to the employee.
    if (doc.autoReminderEmail) {
      await sendExitReminder(doc);
    }

    // Instructions to internal teams (HR/DAA/Admin/Accounts).
    if (doc.autoInstructionsToAllEmail) {
      if (doc.exitStatus === "Serving Notice Period") {
        await sendExitInstructionsToAll(doc);
      } else if (doc.exitStatus === "Already Left" || doc.exitStatus === "Left") {
        await sendExitInstructionsToAllAlready(doc);
      }
    }
  } catch (err) {
    console.error("[triggerNewExit] Email error:", err.message);
  }
}

async function triggerUpdateExit(doc) {
  // Same branching as create - the original Apps Script sends the same
  // set of emails on update, based on current field values.
  return triggerNewExit(doc);
}

module.exports = { triggerNewExit, triggerUpdateExit };
