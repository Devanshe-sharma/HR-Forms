const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

// Replace this with your real upload link (Google Drive, SharePoint, internal portal, etc.)
const MATERIAL_UPLOAD_LINK = 'https://your-company.com/upload-training-materials'; // ← CHANGE THIS

/**
 * Sends 1-week prior reminder to Trainer to upload training materials
 * - Trigger: exactly 7 days before training date
 * - To: Trainer email
 * - CC: HR, Management, Reporting Head, Trainer’s Buddy
 */
async function send1WeekMaterialUploadReminder() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    const targetDate = now.clone().add(7, 'days'); 

    // Find Scheduled trainings exactly 7 days away
    const upcomingTrainings = await Training.find({
      status: 'Scheduled',
      trainingDate: {
        $gte: targetDate.toDate(),
        $lt: targetDate.clone().add(1, 'day').toDate()
      }
    }).lean();

    if (upcomingTrainings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No trainings scheduled exactly 7 days away. Skipping material upload reminder.`);
      return { success: false, reason: 'No upcoming trainings' };
    }

    for (const training of upcomingTrainings) {
      const trainerName = training.trainer?.name || 'Trainer';
      const trainerEmail = training.trainer?.email || 'software.developer@briskolive.com';

      const dateTimeStr = training.trainingDate
        ? moment(training.trainingDate).tz('Asia/Kolkata').format('dddd, MMMM Do YYYY [at] hh:mm A z')
        : 'TBD';

      // CC list – static for now (from .env)
      const ccList = [
        process.env.EMAIL_HR || '',
        process.env.EMAIL_MANAGEMENT || '',
        process.env.EMAIL_TRAINER_REPORTING_HEADS || '',
        process.env.EMAIL_TRAINER_BUDDIES || ''
      ].filter(Boolean).join(',');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #333; line-height: 1.6;">
          <h2 style="color: #7a8b2e;">Upload Training Material – ${training.topic}</h2>
          
          <p>Dear ${trainerName},</p>
          <p>Thank you for conducting the training session on <strong>${training.topic}</strong>.</p>
          
          <p>To support our training documentation and audit requirements, please upload all materials that will be presented during the session such as:</p>
          <ul>
            <li>Presentation (PPT/PDF)</li>
            <li>Assessment/Test links</li>
            <li>Reference documents</li>
          </ul>
          
          <p><strong>Link to upload on:</strong> 
            <a href="${MATERIAL_UPLOAD_LINK}" style="color:#7a8b2e; font-weight:bold;">${MATERIAL_UPLOAD_LINK}</a>
          </p>
          
          <p>This helps us maintain proper records and ensure compliance with internal and external audit requirements.</p>
          
          <p>Regards,<br>
          <strong>HR Team</strong></p>
          
          <HR style="border:none; border-top:1px solid #eee; margin:20px 0;">
          <small style="color:#777; font-size:12px;">
            This is an automated reminder from the HR Training System.<br>
            Training ID: ${training._id}
          </small>
        </div>
      `;

      const result = await sendEmail({
        to: trainerEmail,
        cc: ccList,
        subject: `Upload Training Material – ${training.topic}`,
        html,
      });

      if (result.success) {
        console.log(`1-week material upload reminder sent to trainer: ${trainerName} for ${training.topic}`);
      } else {
        console.error(`Failed to send material upload reminder for ${training.topic}:`, result.error);
      }
    }

    return { success: true, sentCount: upcomingTrainings.length };
  } catch (err) {
    console.error('1-week material upload reminder error:', err.message);
    return { success: false, error: err.message };
  }
}

// (async () => {
//   console.log('=== FORCING 1-WEEK MATERIAL UPLOAD REMINDER TEST ===');
//   const result = await send1WeekMaterialUploadReminder();
//   console.log('Test result:', result);
// })();

module.exports = { send1WeekMaterialUploadReminder };