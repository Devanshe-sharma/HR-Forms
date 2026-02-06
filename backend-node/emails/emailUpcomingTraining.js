const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

async function sendUpcomingTrainingReminder() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    const targetDate = now.clone().add(14, 'days');

    // Find trainings exactly 14 days away, Scheduled, and reminder NOT yet sent
    const upcomingTrainings = await Training.find({
      status: 'Scheduled',
      trainingDate: {
        $gte: targetDate.toDate(),
        $lt: targetDate.clone().add(1, 'day').toDate()
      },
      reminder2WeeksSent: false  // ← key: only send if not already sent
    }).lean();

    if (upcomingTrainings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No new 2-week reminders to send.`);
      return { success: true, sentCount: 0 };
    }

    let sentCount = 0;

    for (const training of upcomingTrainings) {
      const trainerEmail = training.trainer?.email;
      if (!trainerEmail) {
        console.warn(`No trainer email for training: ${training.topic}`);
        continue;
      }

      const ccList = [
        process.env.EMAIL_HR || '',
        process.env.EMAIL_MANAGEMENT || '',
      ].filter(Boolean).join(',');

      const dateTimeStr = moment(training.trainingDate).tz('Asia/Kolkata').format('dddd, MMMM Do YYYY [at] hh:mm A z');
      const venueOrLink = training.mode === 'Online'
        ? training.meetingLink || 'Online link will be shared soon'
        : training.venue || 'Venue details will be shared soon';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
          <h2 style="color: #7a8b2e;">Upcoming Training Scheduled – ${training.topic}</h2>
          
          <p>Dear Team,</p>
          <p>This is to inform you that the following training session has been scheduled:</p>
          
          <ul style="list-style:none; padding-left:0;">
            <li><strong>Training Topic:</strong> ${training.topic}</li>
            <li><strong>Description:</strong> ${training.description || 'No description available'}</li>
            <li><strong>Trainer:</strong> ${training.trainer?.name || 'TBD'}</li>
            <li><strong>Date & Time:</strong> ${dateTimeStr}</li>
            <li><strong>Mode:</strong> ${training.mode || 'TBD'}</li>
            <li><strong>Venue / Link:</strong> ${venueOrLink}</li>
          </ul>
          
          <p>This is a two-week prior intimation. Further reminders will follow closer to the date.</p>
          
          <p>Warm regards,<br>
          <strong>HR Team</strong></p>

          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
          <small style="color:#777; font-size:12px;">
            Training ID: ${training._id}<br>
            Sent on ${now.format('MMMM DD, YYYY [at] hh:mm A z')}
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
        // Mark as sent to prevent re-sending
        await Training.updateOne(
          { _id: training._id },
          { $set: { reminder2WeeksSent: true } }
        );
        console.log(`2-week reminder sent & marked for: ${training.topic} (ID: ${training._id})`);
        sentCount++;
      } else {
        console.error(`Failed to send 2-week reminder for ${training.topic}:`, result.error);
      }
    }

    return { success: true, sentCount };
  } catch (err) {
    console.error('2-week training reminder error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendUpcomingTrainingReminder };