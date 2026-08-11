const sendReferralSubmittedToHR = require('../senders/sendReferralSubmittedToHR');

async function triggerReferralSubmitted(doc) {
  try {
    await sendReferralSubmittedToHR(doc);
  } catch (err) {
    console.error('[triggerReferralSubmitted] Email error:', err.message);
  }
}

module.exports = triggerReferralSubmitted;
