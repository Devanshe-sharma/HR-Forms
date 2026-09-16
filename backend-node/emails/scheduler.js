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
const sendSalaryRevisionMailQueueDigest    = require('./senders/sendSalaryRevisionMailQueueDigest');
const sendConfirmationManagerReminder     = require('./senders/sendConfirmationManagerReminder');
const sendConfirmationManagementReminder  = require('./senders/sendConfirmationManagementReminder');
const sendConfirmationDue                 = require('./senders/sendConfirmationDue');
const sendConfirmationMailQueueDigest      = require('./senders/sendConfirmationMailQueueDigest');

// Import models for auto-archive/complete
const Outing = require('../models/Outing');
const SalaryRevision = require('../models/SalaryRevision');
const { rescoreSalaryRevision } = require('../utils/salaryRevisionScoring');

function startEmailScheduler() {
  const tz = 'Asia/Kolkata';

  console.log('Email & auto-archive scheduler started');

  // 1-5. ALL Training mail jobs are PAUSED, per explicit request (2026-09-14).
  // Re-enable by uncommenting.
  //
  // // 1. Quarterly Training approval request
  // cron.schedule('0 9 1 3,6,9,12 *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending quarterly training approval request`);
  //   try {
  //     await sendQuarterlyApprovalRequest();
  //   } catch (err) {
  //     console.error('Quarterly training approval failed:', err);
  //   }
  // }, { timezone: tz });
  //
  // // 2. 2-week upcoming training reminder
  // cron.schedule('15 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking 2-week training reminders`);
  //   try {
  //     await sendUpcomingTrainingReminder();
  //   } catch (err) {
  //     console.error('2-week training reminder failed:', err);
  //   }
  // }, { timezone: tz });
  //
  // // 3. 1-week training invitation
  // cron.schedule('30 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending 1-week training invitations`);
  //   try {
  //     await send1WeekInvitation();
  //   } catch (err) {
  //     console.error('1-week training invitation failed:', err);
  //   }
  // }, { timezone: tz });
  //
  // // 4. 1-week material upload reminder
  // cron.schedule('45 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending material upload reminders`);
  //   try {
  //     await send1WeekMaterialUploadReminder();
  //   } catch (err) {
  //     console.error('Material upload reminder failed:', err);
  //   }
  // }, { timezone: tz });
  //
  // // 5. On-day training feedback reminder
  // cron.schedule('0 10 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending on-day training feedback reminders`);
  //   try {
  //     await sendOnDayFeedbackReminder();
  //   } catch (err) {
  //     console.error('On-day training feedback reminder failed:', err);
  //   }
  // }, { timezone: tz });

  // 6-7. ALL Outing mail jobs are PAUSED, per explicit request (2026-09-14).
  // Re-enable by uncommenting.
  //
  // // 6. Quarterly Outing/Event approval request
  // cron.schedule('0 9 1 3,6,9,12 *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending quarterly outing approval request`);
  //   try {
  //     await sendQuarterlyOutingApprovalRequest();
  //   } catch (err) {
  //     console.error('Quarterly outing approval failed:', err);
  //   }
  // }, { timezone: tz });
  //
  // // 7. 2-week upcoming outing/event reminder
  // cron.schedule('0 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking 2-week outing reminders`);
  //   try {
  //     await sendUpcomingOutingReminder();
  //   } catch (err) {
  //     console.error('2-week outing reminder failed:', err);
  //   }
  // }, { timezone: tz });

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

  // 9d-9f. Salary Revision cron jobs — RE-ENABLED (2026-09-15). These no
  // longer send anything themselves: since the mail-queue redesign, every
  // one of them just QUEUES an editable draft (see
  // utils/salaryRevisionMailQueue.js) for HR to review/edit/send from the
  // dashboard's Mail Queue tab. Actual sending is separately gated behind
  // SALARY_REVISION_MAILS_ENABLED in .env (currently unset/false), so
  // running these jobs is safe — nothing leaves the building on its own.

  // 9d. Salary Revision — employees due this fiscal quarter, for
  // Management. Fires on the 1st of each fiscal-quarter start month
  // (Apr/Jul/Oct/Jan).
  cron.schedule('0 9 1 4,7,10,1 *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Queuing salary revision due-this-quarter digest`);
    try {
      const result = await sendSalaryRevisionDue();
      console.log(`Salary revision due-this-quarter digest queued — ${result.dueCount} employee(s)`);
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
      console.log(`Salary revision manager escalation queued — ${result.escalatedCount} revision(s)`);
    } catch (err) {
      console.error('Salary revision manager escalation failed:', err);
    }
  }, { timezone: tz });

  cron.schedule('20 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking salary revision final escalations`);
    try {
      const result = await sendSalaryRevisionFinalEscalation();
      console.log(`Salary revision final escalation queued — ${result.escalatedCount} revision(s)`);
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

  // 9h. Salary Revision Mail Queue digest — the ONE Salary Revision mail
  // that still sends itself automatically, per explicit instruction
  // (2026-09-15): everything else (Mail 1-6, HR notify, quarterly digest)
  // is now queued as an editable draft, sent only when HR clicks Send in
  // the dashboard's Mail Queue (routes/salaryRevisionMailDrafts.js). This
  // job just tells HR — and only HR — that drafts are waiting for review.
  // PAUSED for now, per "do not start mails" — re-enable by uncommenting
  // once ready.
  //
  // cron.schedule('0 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending Salary Revision Mail Queue digest to HR`);
  //   try {
  //     const result = await sendSalaryRevisionMailQueueDigest();
  //     console.log(`Salary Revision Mail Queue digest — ${result.queuedCount} draft(s) pending`);
  //   } catch (err) {
  //     console.error('Salary Revision Mail Queue digest failed:', err);
  //   }
  // }, { timezone: tz });

  // ─── Confirmations mail queue (added 2026-09-16) ───────────────────────────
  // Same convention as Salary Revision above — every one of these QUEUES
  // an editable draft (utils/confirmationMailQueue.js), none of them
  // send. Manager Request (Mail 1) itself isn't cron-driven — it fires
  // directly off advanceStageIfDue() in routes/confirmations.js the
  // moment a review opens (and off the extension-reopen in
  // scheduler/extensionScheduler.js), same as Management Request (Mail 2)
  // and HR Notify (Mail 3) fire directly off their own route transitions.

  // 9i. Confirmation — quarterly due digest, to Management. Same schedule
  // as Salary Revision's (1st of Apr/Jul/Oct/Jan), offset 15 minutes so
  // the two quarterly jobs don't run in the same instant.
  cron.schedule('15 9 1 4,7,10,1 *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Queuing confirmation due-this-quarter digest`);
    try {
      const result = await sendConfirmationDue();
      console.log(`Confirmation due-this-quarter digest queued — ${result.dueCount} employee(s)`);
    } catch (err) {
      console.error('Confirmation due-this-quarter digest failed:', err);
    }
  }, { timezone: tz });

  // 9j. Confirmation — manager reminder sweep (Mail 1a).
  cron.schedule('40 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking confirmation manager reminders`);
    try {
      const result = await sendConfirmationManagerReminder();
      console.log(`Confirmation manager reminder queued — ${result.remindedCount} record(s)`);
    } catch (err) {
      console.error('Confirmation manager reminder failed:', err);
    }
  }, { timezone: tz });

  // 9k. Confirmation — management reminder sweep (Mail 2a).
  cron.schedule('45 9 * * *', async () => {
    console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Checking confirmation management reminders`);
    try {
      const result = await sendConfirmationManagementReminder();
      console.log(`Confirmation management reminder queued — ${result.remindedCount} record(s)`);
    } catch (err) {
      console.error('Confirmation management reminder failed:', err);
    }
  }, { timezone: tz });

  // 9l. Confirmation Mail Queue digest — the ONE Confirmation mail that
  // still sends itself automatically, mirroring Salary Revision's own
  // paused digest (9h above) exactly. Everything else in this feature is
  // queued as an editable draft, sent only when HR clicks Send in the
  // dashboard's Mail Queue (routes/confirmationMailDrafts.js). This job
  // just tells HR — and only HR — that drafts are waiting for review.
  // PAUSED for now, per the standing "no auto email" instruction —
  // re-enable by uncommenting once ready.
  //
  // cron.schedule('50 9 * * *', async () => {
  //   console.log(`[${moment().tz(tz).format('YYYY-MM-DD HH:mm:ss z')}] Sending Confirmation Mail Queue digest to HR`);
  //   try {
  //     const result = await sendConfirmationMailQueueDigest();
  //     console.log(`Confirmation Mail Queue digest — ${result.queuedCount} draft(s) pending`);
  //   } catch (err) {
  //     console.error('Confirmation Mail Queue digest failed:', err);
  //   }
  // }, { timezone: tz });

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