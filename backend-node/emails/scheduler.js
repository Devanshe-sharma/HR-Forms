const cron = require('node-cron');
const moment = require('moment-timezone');

// Import all email functions from same folder
const { sendQuarterlyApprovalRequest } = require('./emailQuarterlyPlan');
const { sendUpcomingTrainingReminder } = require('./emailUpcomingTraining');
const { send1WeekInvitation } = require('./email1WeekInvitation');
const { send1WeekMaterialUploadReminder } = require('./email1WeekMaterialUpload');
const { sendOnDayFeedbackReminder } = require('./emailOnDayFeedback');
const { sendQuarterlyOutingApprovalRequest } = require('./emailQuarterlyOutingApproval');
const { sendUpcomingOutingReminder } = require('./emailUpcomingOutingReminder');

// Import models for auto-archive/complete
const Outing = require('../models/Outing');

function startEmailScheduler() {
  const tz = 'Asia/Kolkata';

  console.log('Email & auto-archive scheduler started');

  // 1. Quarterly Training approval request
  cron.schedule('0 9 1 3,6,9,12 *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending quarterly training approval request`);
    try {
      await sendQuarterlyApprovalRequest();
    } catch (err) {
      console.error('Quarterly training approval failed:', err);
    }
  }, { timezone: tz });

  // 2. 2-week upcoming training reminder
  cron.schedule('15 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking 2-week training reminders`);
    try {
      await sendUpcomingTrainingReminder();
    } catch (err) {
      console.error('2-week training reminder failed:', err);
    }
  }, { timezone: tz });

  // 3. 1-week training invitation
  cron.schedule('30 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending 1-week training invitations`);
    try {
      await send1WeekInvitation();
    } catch (err) {
      console.error('1-week training invitation failed:', err);
    }
  }, { timezone: tz });

  // 4. 1-week material upload reminder
  cron.schedule('45 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending material upload reminders`);
    try {
      await send1WeekMaterialUploadReminder();
    } catch (err) {
      console.error('Material upload reminder failed:', err);
    }
  }, { timezone: tz });

  // 5. On-day training feedback reminder
  cron.schedule('0 10 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending on-day training feedback reminders`);
    try {
      await sendOnDayFeedbackReminder();
    } catch (err) {
      console.error('On-day training feedback reminder failed:', err);
    }
  }, { timezone: tz });

  // 6. Quarterly Outing/Event approval request
  cron.schedule('0 9 1 3,6,9,12 *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending quarterly outing approval request`);
    try {
      await sendQuarterlyOutingApprovalRequest();
    } catch (err) {
      console.error('Quarterly outing approval failed:', err);
    }
  }, { timezone: tz });

  // 7. 2-week upcoming outing/event reminder
  cron.schedule('0 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking 2-week outing reminders`);
    try {
      await sendUpcomingOutingReminder();
    } catch (err) {
      console.error('2-week outing reminder failed:', err);
    }
  }, { timezone: tz });

  // ─── Outing Auto-Complete & Auto-Archive ───
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily outing auto-archive job...');
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

  cron.schedule('5 0 * * *', async () => {
    console.log('Running daily outing auto-complete job...');
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
      console.error('Outing auto-complete failed:', err);
    }
  }, { timezone: tz });
}

module.exports = { startEmailScheduler };