const sendCandidateApplicationReceived = require("../senders/sendCandidateApplicationReceived");
const sendNewCandidateApplicationToHR  = require("../senders/sendNewCandidateApplicationToHR");

async function triggerCandidateApplication(doc) {
  try {
    await sendCandidateApplicationReceived(doc);
    await sendNewCandidateApplicationToHR(doc);
  } catch (err) {
    console.error("[triggerCandidateApplication] Email error:", err.message);
  }
}

module.exports = triggerCandidateApplication;