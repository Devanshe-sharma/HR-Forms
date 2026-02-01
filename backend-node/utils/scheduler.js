const cron = require('node-cron');
const { sendQuarterlyApprovalRequest } = require('./emailQuarterlyPlan');

function startEmailScheduler() {
  // Runs once per day at a random minute between 9:00 and 9:59 AM IST
  cron.schedule('*/1 9 * * *', async () => {
    const now = moment().tz('Asia/Kolkata');
    if (now.minutes() >= 0 && now.minutes() <= 59) { // already in 9 AM hour
      console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Checking quarterly approval send...`);
      await sendQuarterlyApprovalRequest();
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('Quarterly approval email scheduler started (checks daily 9:00–10:00 AM IST)');
}

module.exports = { startEmailScheduler };