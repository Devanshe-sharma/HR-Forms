const sendReferralBonusEligible = require('../senders/sendReferralBonusEligible');

async function triggerReferralBonus(doc) {
  try {
    await sendReferralBonusEligible(doc);
  } catch (err) {
    console.error('[triggerReferralBonus] Email error:', err.message);
  }
}

module.exports = triggerReferralBonus;
