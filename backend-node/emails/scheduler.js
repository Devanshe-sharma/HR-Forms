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
const sendWeeklyExitSummary = require('./senders/sendWeeklyExitSummary');
const sendDailyApplicantSummary = require('./senders/sendDailyApplicantSummary');
const sendWeeklyRecruitmentSummary = require('./senders/sendWeeklyRecruitmentSummary');
const sendWeeklyOnboardingSummary = require('./senders/sendWeeklyOnboardingSummary');
const sendSalaryRevisionDue = require('./senders/sendSalaryRevisionDue');
const sendSalaryRevisionAutoTrigger = require('./senders/sendSalaryRevisionAutoTrigger');
const sendSalaryRevisionManagerEscalation = require('./senders/sendSalaryRevisionManagerEscalation');
const sendSalaryRevisionFinalEscalation   = require('./senders/sendSalaryRevisionFinalEscalation');

// Import models for auto-archive/complete
const Outing = require('../models/Outing');
const SalaryRevision = require('../models/SalaryRevision');
const { rescoreSalaryRevision } = require('../utils/salaryRevisionScoring');

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

  // 8. Weekly Exit summary — every Monday at 9am (port of the Apps
  // Script's sendWeeklyEmail(), which had no explicit cron trigger visible
  // in the source — adjust the schedule below if you know the original
  // actually ran on a different day/time).
  cron.schedule('0 9 * * 1', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending weekly exit summary`);
    try {
      const result = await sendWeeklyExitSummary();
      console.log(`Weekly exit summary sent — ${result.openCount} open exit(s)`);
    } catch (err) {
      console.error('Weekly exit summary failed:', err);
    }
  }, { timezone: tz });

  // 9a. Weekly Recruitment (open hiring requisitions) FMS summary —
  // every Monday at 9am, alongside the weekly exit/onboarding summaries.
  cron.schedule('0 9 * * 1', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending weekly recruitment summary`);
    try {
      const result = await sendWeeklyRecruitmentSummary();
      console.log(`Weekly recruitment summary sent — ${result.openCount} open requisition(s)`);
    } catch (err) {
      console.error('Weekly recruitment summary failed:', err);
    }
  }, { timezone: tz });

  // 9b. Weekly Onboarding FMS summary — every Monday at 9am.
  cron.schedule('0 9 * * 1', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending weekly onboarding summary`);
    try {
      const result = await sendWeeklyOnboardingSummary();
      console.log(`Weekly onboarding summary sent — ${result.openCount} open FMS(s)`);
    } catch (err) {
      console.error('Weekly onboarding summary failed:', err);
    }
  }, { timezone: tz });

  // 9c. Daily candidate applicant summary — 9am, covering the full
  // previous calendar day's applications. Replaces the old immediate
  // per-application HR email (disabled in triggerCandidateApplication.js)
  // so HR gets one batched digest instead of being pinged for every
  // single submission throughout the day.
  cron.schedule('0 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending daily applicant summary`);
    try {
      await sendDailyApplicantSummary();
    } catch (err) {
      console.error('Daily applicant summary failed:', err);
    }
  }, { timezone: tz });

  // 9d. Salary Revision — employees due this fiscal quarter, for
  // Management. Fires on the 1st of each fiscal-quarter start month
  // (Apr/Jul/Oct/Jan).
  cron.schedule('0 9 1 4,7,10,1 *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending salary revision due-this-quarter digest`);
    try {
      const result = await sendSalaryRevisionDue();
      console.log(`Salary revision due-this-quarter digest sent — ${result.dueCount} employee(s)`);
    } catch (err) {
      console.error('Salary revision due-this-quarter digest failed:', err);
    }
  }, { timezone: tz });

  // 9e. Salary Revision — auto-create + Mail 1 for anyone whose Reminder
  // Date (due date minus 1 month) lands in the current calendar month.
  // Runs before the escalation checks below so a same-day auto-created
  // revision is never immediately flagged as escalation-worthy.
  cron.schedule('45 8 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking for salary revisions due this month`);
    try {
      const result = await sendSalaryRevisionAutoTrigger();
      console.log(`Salary revision auto-trigger — ${result.createdCount} revision(s) created: ${result.createdFor.join(', ') || '(none)'}`);
      if (result.failures.length) console.error('Salary revision auto-trigger failures:', result.failures);
    } catch (err) {
      console.error('Salary revision auto-trigger failed:', err);
    }
  }, { timezone: tz });

  // 9f. Salary Revision — manager-recommendation escalation chain. Daily
  // check for revisions still 'pending_manager' past the response window
  // (Mail 5), and a further check for the final escalation (Mail 6).
  cron.schedule('0 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking salary revision manager escalations`);
    try {
      const result = await sendSalaryRevisionManagerEscalation();
      console.log(`Salary revision manager escalation sent — ${result.escalatedCount} revision(s)`);
    } catch (err) {
      console.error('Salary revision manager escalation failed:', err);
    }
  }, { timezone: tz });

  cron.schedule('20 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking salary revision final escalations`);
    try {
      const result = await sendSalaryRevisionFinalEscalation();
      console.log(`Salary revision final escalation sent — ${result.escalatedCount} revision(s)`);
    } catch (err) {
      console.error('Salary revision final escalation failed:', err);
    }
  }, { timezone: tz });

  // 9g. Salary Revision — daily re-score sweep. A task's score/status can
  // go stale purely from time passing (a plan date slipping into Overdue)
  // with no route ever being hit — this keeps every open revision's FMS
  // score current regardless of whether anyone actually acted that day.
  cron.schedule('30 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Re-scoring open salary revisions`);
    try {
      const open = await SalaryRevision.find({ fmsStatus: 'Open' }).select('_id');
      for (const { _id } of open) {
        await rescoreSalaryRevision(_id);
      }
      console.log(`Salary revision re-score sweep — ${open.length} open revision(s) checked`);
    } catch (err) {
      console.error('Salary revision re-score sweep failed:', err);
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