const sendExitProgress                  = require("../senders/sendExitProgress");
const sendExitAcceptanceByType          = require("../senders/sendExitAcceptanceByType");
const sendExitReminder                  = require("../senders/sendExitReminder");
const sendExitInstructionsToAll         = require("../senders/sendExitInstructionsToAll");
const sendExitInstructionsToAllAlready  = require("../senders/sendExitInstructionsToAllAlready");

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
    // No mail until HR has explicitly approved the exit (see PATCH
    // :id/approve in routes/exit.js) — replaces the old blanket
    // EXIT_EMAILS_TEMPORARILY_DISABLED kill switch (2026-09-17) with the
    // actual intended gate: an exit still "Awaiting Approval" must not
    // notify anyone, but an approved one sends normally again.
    if (!doc.hr_approved_at) {
      console.log("[triggerNewExit] Exit not yet approved; skipping send.");
      return;
    }

    // Exit Cancelled - no progress/checklist email, matching the original
    // Apps Script's early-return behavior.
    if (doc.exitStatus === "Exit Cancelled") {
      return;
    }

    // Main status email - always sent on create/update.
    await sendExitProgress(doc);

    // Acceptance email to the employee themselves — content is chosen by
    // exitType (Resignation/Completion of Tenure/Retirement/Demise/
    // Termination/Asked to Leave/Absconded) where recognized, falling
    // back to the original exitStatus-only emails otherwise. Still gated
    // on exitStatus here the same as before — an exit still "Serving
    // Notice Period"/"Already Left"/"Left" is what actually means an
    // acceptance email is due at all.
    if (doc.autoExitEmail) {
      if (["Serving Notice Period", "Already Left", "Left"].includes(doc.exitStatus)) {
        await sendExitAcceptanceByType(doc);
      }
    }

    // Reminder email to the employee.
    if (doc.autoReminderEmail) {
      await sendExitReminder(doc);
    }

    // Instructions to internal teams (HR/Data Analytics and Automation/Admin/Accounts).
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
