const cron = require('node-cron');
const moment = require('moment-timezone');

// Import all reminder functions
const { sendQuarterlyApprovalRequest } = require('./emailQuarterlyPlan');
const { sendUpcomingTrainingReminder } = require('./emailUpcomingTraining');
const { send1WeekInvitation } = require('./email1WeekInvitation');
const { send1WeekMaterialUploadReminder } = require('./email1WeekMaterialUpload'); 
const { sendOnDayFeedbackReminder } = require('./emailOnDayFeedback');

function startEmailScheduler() {
  const tz = 'Asia/Kolkata';

  // 1. Daily at 9:00 AM – Quarterly approval request (once per day)
  cron.schedule('0 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending quarterly approval requests`);
    try {
      await sendQuarterlyApprovalRequest();
    } catch (err) {
      console.error('Quarterly approval email failed:', err);
    }
  }, { timezone: tz });

  // 2. Daily at 9:15 AM – 2-week upcoming training reminder
  cron.schedule('15 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending 2-week training reminders`);
    try {
      await sendUpcomingTrainingReminder();
    } catch (err) {
      console.error('2-week reminder failed:', err);
    }
  }, { timezone: tz });

  // 3. Daily at 9:30 AM – 1-week invitation
  cron.schedule('30 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending 1-week invitations`);
    try {
      await send1WeekInvitation();
    } catch (err) {
      console.error('1-week invitation failed:', err);
    }
  }, { timezone: tz });

  // 4. Daily at 9:45 AM – 1-week material upload reminder
  cron.schedule('45 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending material upload reminders`);
    try {
      await send1WeekMaterialUploadReminder();
    } catch (err) {
      console.error('Material upload reminder failed:', err);
    }
  }, { timezone: tz });

  // 5. Daily at 10:00 AM – On-day feedback reminder
  cron.schedule('0 10 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending on-day feedback reminders`);
    try {
      await sendOnDayFeedbackReminder();
    } catch (err) {
      console.error('On-day feedback reminder failed:', err);
    }
  }, { timezone: tz });

  // ─── Outing Auto-Archive (daily at midnight) ───
  cron.schedule('0 0 * * *', async () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    try {
      const result = await Outing.updateMany(
        {
          tentativeDate: { $lt: threeMonthsAgo },
          status: { $nin: ['Archived', 'Rejected'] }
        },
        { $set: { status: 'Archived', archivedAt: now } }
      );
      console.log(`Archived ${result.modifiedCount} old outings`);
    } catch (err) {
      console.error('Outing auto-archive failed:', err);
    }
  }, { timezone: tz });

  // ─── Auto-Complete Past Outings (daily at 00:05) ───
  cron.schedule('5 0 * * *', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const completed = await Outing.updateMany(
        {
          tentativeDate: { $lte: today },
          status: 'Scheduled'
        },
        { $set: { status: 'Completed' } }
      );
      console.log(`Auto-completed ${completed.modifiedCount} past outings`);
    } catch (err) {
      console.error('Auto-complete failed:', err);
    }
  }, { timezone: tz });

  console.log('Email & auto-archive scheduler started');
}

module.exports = { startEmailScheduler };