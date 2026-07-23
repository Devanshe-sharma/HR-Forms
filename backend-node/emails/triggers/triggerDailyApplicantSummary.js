const sendDailyApplicantSummary = require('../senders/sendDailyApplicantSummary');

async function triggerDailyApplicantSummary() {
  try {
    await sendDailyApplicantSummary();
  } catch (err) {
    console.error('[triggerDailyApplicantSummary] Email error:', err.message);
  }
}

module.exports = triggerDailyApplicantSummary;