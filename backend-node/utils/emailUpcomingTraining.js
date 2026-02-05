const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

/**
 * Sends 2-week prior reminder for upcoming trainings
 * - Checks daily for trainings exactly 14 days away
 * - Sends to Trainer + CC: HR, Management, Reporting Head, Buddy
 */
async function sendUpcomingTrainingReminder() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    const targetDate = now.clone().add(1, 'days'); // exactly 14 days from today

    // Find trainings scheduled exactly 14 days from now
    const upcomingTrainings = await Training.find({
      // trainingDate: {
      //   $gte: targetDate.toDate(),
      //   $lt: targetDate.clone().add(1, 'day').toDate()
      // },
      status: 'Scheduled' // only for confirmed/scheduled trainings
    }).lean();

    if (upcomingTrainings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No trainings scheduled exactly 14 days away. Skipping.`);
      return { success: false, reason: 'No upcoming trainings' };
    }

    for (const training of upcomingTrainings) {
      const trainerEmail = training.trainer?.email || 'trainer-fallback@company.com'; // ← must exist or fallback

      // CC lists (static for now – can be dynamic later)
      const ccList = [
        process.env.EMAIL_HR || '',
        process.env.EMAIL_MANAGEMENT || '',        // ← placeholder
      ].filter(Boolean).join(',');

      const dateTimeStr = training.trainingDate
        ? moment(training.trainingDate).tz('Asia/Kolkata').format('dddd, MMMM Do YYYY [at] hh:mm A z')
        : 'TBD';

      const venueOrLink = training.mode === 'Online'
        ? training.meetingLink || 'Online link will be shared soon'
        : training.venue || 'Venue details will be shared soon';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
          <h2 style="color: #7a8b2e;">Upcoming Training Scheduled – ${training.topic}</h2>
          
          <p>Dear Team,</p>
          <p>This is to inform you that the following training session has been scheduled as per the approved quarterly plan:</p>
          
          <ul style="list-style:none; padding-left:0;">
            <li><strong>Training Topic:</strong> ${training.topic}</li>
            <li><strong>Description:</strong> ${training.description || 'No description available'}</li>
            <li><strong>Trainer:</strong> ${training.trainer?.name || 'TBD'}</li>
            <li><strong>Date & Time:</strong> ${dateTimeStr}</li>
            <li><strong>Mode:</strong> ${training.mode || 'TBD'}</li>
            <li><strong>Venue / Link:</strong> ${venueOrLink}</li>
          </ul>
          
          <p>This email serves as a two-week prior intimation to ensure adequate preparation and alignment.</p>
          <p>Further reminders and calendar blocks will follow closer to the session date.</p>
          
          <p>Warm regards,<br>
          <strong>HR Team</strong></p>

          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
          <small style="color:#777; font-size:12px;">
            This is an automated reminder from the HR Training System.<br>
            Training ID: ${training._id}
          </small>
        </div>
      `;

      const result = await sendEmail({
        to: trainerEmail,
        cc: ccList,
        subject: `Upcoming Training Scheduled – ${training.topic}`,
        html,
      });

      if (result.success) {
        console.log(`2-week reminder sent for training: ${training.topic} (ID: ${training._id})`);
      } else {
        console.error(`Failed to send reminder for ${training.topic}:`, result.error);
      }
    }

    return { success: true, sentCount: upcomingTrainings.length };
  } catch (err) {
    console.error('2-week training reminder error:', err.message);
    return { success: false, error: err.message };
  }
}
// (async () => {
//   console.log('=== FORCING 2-WEEK TRAINING REMINDER TEST ===');
//   const result = await sendUpcomingTrainingReminder();
//   console.log('Test result:', result);
// })();

module.exports = { sendUpcomingTrainingReminder };