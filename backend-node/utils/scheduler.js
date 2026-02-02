const cron = require('node-cron');
const moment = require('moment-timezone');

// Import all reminder functions
const { sendQuarterlyApprovalRequest } = require('./emailQuarterlyPlan');
const { sendUpcomingTrainingReminder } = require('./emailUpcomingTraining');
const { send1WeekInvitation } = require('./email1WeekInvitation');
const { send1WeekMaterialUploadReminder } = require('./email1WeekMaterialUpload'); 
const { sendOnDayFeedbackReminder } = require('./emailOnDayFeedback');

function startEmailScheduler() {
  // 1. Quarterly approval request (daily check 9:00–9:59 AM IST)
  cron.schedule('*/1 9 * * *', async () => {
    const now = moment().tz('Asia/Kolkata');
    if (now.minutes() >= 0 && now.minutes() <= 59) {
      console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Checking quarterly approval send...`);
      const result = await sendQuarterlyApprovalRequest();
      console.log('Quarterly approval result:', result);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 2. 2-week training reminder (daily check 9:00–9:59 AM IST)
  cron.schedule('*/1 9 * * *', async () => {
    const now = moment().tz('Asia/Kolkata');
    if (now.minutes() >= 0 && now.minutes() <= 59) {
      console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Checking 2-week training reminders...`);
      const result = await sendUpcomingTrainingReminder();
      console.log('2-week reminder result:', result);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // 3. All other training reminders (1-week invitation, material upload, on-day feedback)
  // Run at fixed 9:30 AM IST
  cron.schedule('15 9 * * *', async () => {
    console.log(`[${moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss z')}] Checking 1-week training invitations...`);
    const result = await send1WeekInvitation();
    console.log('1-week invitation result:', result);
  }, {
    timezone: 'Asia/Kolkata'
  });

  cron.schedule('45 9 * * *', async () => {
  const now = moment().tz('Asia/Kolkata');
  console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Checking 1-week material upload reminders...`);
  const result = await send1WeekMaterialUploadReminder();
  console.log('1-week material upload result:', result);
}, {
  timezone: 'Asia/Kolkata'
});

cron.schedule('0 10 * * *', async () => {
  const now = moment().tz('Asia/Kolkata');
  console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Checking on-day feedback reminders...`);
  const result = await sendOnDayFeedbackReminder();
  console.log('On-day feedback result:', result);
}, {
  timezone: 'Asia/Kolkata'
});


//outingss -------------------------------------

cron.schedule('0 0 * * *', async () => {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  await Outing.updateMany(
    { tentativeDate: { $lt: threeMonthsAgo }, status: { $ne: 'Archived' } },
    { $set: { status: 'Archived', archivedAt: now } }
  );
  console.log('Old outings archived');
}, { timezone: 'Asia/Kolkata' });

cron.schedule('0 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const completedYesterday = await Outing.find({
    tentativeDate: { $gte: yesterday, $lt: new Date() },
    status: 'Completed'
  });

  for (const outing of completedYesterday) {
    const attendees = outing.feedbacks?.filter(f => f.attended) || [];
    const feedbackGiven = attendees.filter(f => f.submittedAt);

    const missing = attendees.filter(a => !feedbackGiven.some(f => f.employeeName === a.employeeName));

    for (const miss of missing) {
      outing.discrepancies.push({
        employeeName: miss.employeeName,
        reason: 'No feedback submitted after attending',
        createdAt: new Date(),
      });
    }

    await outing.save();
  }
});

}

module.exports = { startEmailScheduler };