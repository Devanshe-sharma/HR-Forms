const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

/**
 * Sends mandatory feedback reminder on the day of training
 * - Trigger: Same day as trainingDate (runs daily, checks today's trainings)
 * - To: All employees (hardcoded test email for now)
 * - CC: Management
 */
async function sendOnDayFeedbackReminder() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    
    // Find trainings happening TODAY
    const todaysTrainings = await Training.find({
      status: 'Scheduled', // or 'Completed' if you update status after end
      trainingDate: {
        $gte: now.toDate(),
        $lt: now.clone().add(1, 'day').toDate()
      }
    }).lean();

    if (todaysTrainings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No trainings today. Skipping feedback reminder.`);
      return { success: false, reason: 'No trainings today' };
    }

    for (const training of todaysTrainings) {
      const topic = training.topic || 'Training Session';
      const feedbackLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/training?tab=employee-feedback&trainingId=${training._id}`;

      // For testing: send to your own email instead of "all employees"
      const recipients = 'devanshesharma6@gmail.com'; // ← CHANGE TO REAL ALL-EMPLOYEES LIST LATER

      await sendEmail({
        to: recipients,
        cc: process.env.EMAIL_MANAGEMENT || 'devanshesharma6@gmail.com',
        subject: `Mandatory Training Feedback – ${topic}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; color: #333; line-height: 1.6;">
            <h2 style="color: #7a8b2e;">Mandatory Training Feedback – ${topic}</h2>
            
            <p>Dear Participant,</p>
            <p>Thank you for attending the training session on <strong>${topic}</strong>.</p>
            
            <p>As part of our learning evaluation process, we request you to submit your feedback using the link below:</p>
            
            <p style="text-align:center; margin:30px 0;">
              <a href="${feedbackLink}" style="display:inline-block; background:#7a8b2e; color:white; padding:14px 32px; text-decoration:none; border-radius:8px; font-size:18px; font-weight:bold;">
                👉 Submit Feedback Now
              </a>
            </p>
            
            <p><strong>⚠ Important Notes:</strong></p>
            <ul>
              <li>The feedback form is <strong>mandatory</strong></li>
              <li>It will remain open for <strong>4–5 hours only</strong></li>
              <li>Feedback submission is considered as <strong>attendance confirmation</strong></li>
            </ul>
            
            <p>Your honest feedback helps us improve training quality and effectiveness.</p>
            
            <p>Regards,<br>
            <strong>HR Team</strong></p>
            
            <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
            <small style="color:#777; font-size:12px;">
              This is an automated reminder from the HR Training System.<br>
              Training ID: ${training._id}
            </small>
          </div>
        `,
      });

      console.log(`On-day feedback reminder sent for: ${topic} (ID: ${training._id})`);
    }

    return { success: true, sentCount: todaysTrainings.length };
  } catch (err) {
    console.error('On-day feedback reminder error:', err.message);
    return { success: false, error: err.message };
  }
}
// TEMP TEST – REMOVE AFTER
// (async () => {
//   console.log('=== FORCING ON-DAY FEEDBACK REMINDER TEST ===');
//   const result = await sendOnDayFeedbackReminder();
//   console.log('Test result:', result);
// })();


module.exports = { sendOnDayFeedbackReminder };