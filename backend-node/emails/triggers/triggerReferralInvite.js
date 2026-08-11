const sendReferralInvite = require('../senders/sendReferralInvite');

async function triggerReferralInvite(doc) {
  try {
    await sendReferralInvite(doc);
  } catch (err) {
    console.error('[triggerReferralInvite] Email error:', err.message);
  }
}

module.exports = triggerReferralInvite;
