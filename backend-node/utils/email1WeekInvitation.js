const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

/**
 * Sends 1-week invitation email to all employees for upcoming trainings
 * - Trigger: 7 days before training date
 * - To: All employees (hardcoded test email for now)
 * - CC: Management
 */
async function send1WeekInvitation() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    const targetDate = now.clone().add(7, 'days'); // exactly 7 days from today

    // TEMP FOR TEST: Comment date filter to force send for ALL Scheduled trainings
    const upcomingTrainings = await Training.find({
      status: 'Scheduled',
      trainingDate: { $gte: targetDate.toDate(), $lt: targetDate.clone().add(1, 'day').toDate() } // ← comment for test
    }).lean();

    console.log(`FORCE TEST MODE: Found ${upcomingTrainings.length} Scheduled trainings`);

    if (upcomingTrainings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No Scheduled trainings found. Skipping.`);
      return { success: false, reason: 'No Scheduled trainings' };
    }

    for (const training of upcomingTrainings) {
      const trainerName = training.trainer?.name || 'TBD';
      const dateTimeStr = training.trainingDate
        ? moment(training.trainingDate).tz('Asia/Kolkata').format('dddd, MMMM Do YYYY [at] hh:mm A z')
        : 'TBD';

      const venueOrLink = training.mode === 'Online'
        ? (training.meetingLink || 'Online link will be shared soon')
        : (training.venue || 'Venue details will be shared soon');

      const feedbackLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/training?tab=employee-feedback`;

      // For testing: send to your own email instead of "all employees"
      const recipients = 'devanshesharma6@gmail.com'; // ← CHANGE TO REAL LIST LATER

      await sendEmail({
        to: recipients,
        cc: process.env.EMAIL_MANAGEMENT || 'devanshesharma6@gmail.com',
        subject: `Invitation for Training: ${training.topic}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #333; line-height: 1.6;">
            <h2 style="color: #7a8b2e;">Invitation for Training: ${training.topic}</h2>
            
            <p>Dear Team,</p>
            <p>The upcoming training session is scheduled as per the quarterly training plan.</p>
            
            <p><strong>Training Details:</strong></p>
            <ul style="list-style:none; padding-left:0;">
              <li>• <strong>Topic:</strong> ${training.topic}</li>
              <li>• <strong>Trainer:</strong> ${trainerName}</li>
              <li>• <strong>Date & Time:</strong> ${dateTimeStr}</li>
              <li>• <strong>Mode:</strong> ${training.mode || 'TBD'}</li>
              <li>• <strong>Venue / Link:</strong> ${venueOrLink}</li>
              <li>• <strong>Employee feedback form:</strong> <a href="${feedbackLink}" style="color:#7a8b2e;">Click to Submit Feedback</a></li>
            </ul>
            
            <p>A calendar invite has been shared along with this email. Kindly ensure your availability and active participation.</p>
            <p>Your attendance and feedback are essential for successful completion of the training.</p>
            
            <p>Best regards,<br>
            <strong>HR Team</strong></p>
            
            <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
            <small style="color:#777; font-size:12px;">
              This is an automated invitation from the HR Training System.<br>
              Training ID: ${training._id}
            </small>
          </div>
        `,
      });

      console.log(`1-week invitation TEST sent for: ${training.topic} (ID: ${training._id})`);
    }

    return { success: true, sentCount: upcomingTrainings.length };
  } catch (err) {
    console.error('1-week invitation error:', err.message);
    return { success: false, error: err.message };
  }
}

// TEMP TEST BLOCK – REMOVE AFTER TESTING
// (async () => {
//   console.log('=== FORCING 1-WEEK INVITATION TEST ===');
//   const result = await send1WeekInvitation();
//   console.log('Test result:', result);
// })();

module.exports = { send1WeekInvitation };