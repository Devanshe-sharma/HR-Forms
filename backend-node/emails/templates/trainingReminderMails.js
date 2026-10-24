// emails/templates/trainingReminderMails.js
// ─────────────────────────────────────────────────────────────────────────────
// The other 4 manual, per-training training mails (alongside
// trainingScheduleNotification.js) — rebuilt against the CURRENT
// TrainingSchedule schema (trainingName/trainerName/venue/onlineLink/
// contentPdfLink/assessmentLink), replacing an older generation of
// templates (emailUpcomingTraining.js, email1WeekInvitation.js,
// email1WeekMaterialUpload.js, emailOnDayFeedback.js) that referenced
// fields (trainer.email, mode, topic, description) which don't exist on
// this model and were never wired up correctly. All of these are sent
// manually (preview, then explicit Send) from the Final Training
// Scheduling tab — never automatically.
// ─────────────────────────────────────────────────────────────────────────────

const { feedbackClosesAt, fmtIst } = require('../../utils/trainingFeedbackWindow');
const { signTrainingFeedback } = require('../../utils/trainingFeedbackSigning');

function formatDateWithWeekday(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const weekday = d.toLocaleString('en-GB', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  const day     = d.toLocaleString('en-GB', { day: '2-digit', timeZone: 'Asia/Kolkata' });
  const month   = d.toLocaleString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
  const year    = d.toLocaleString('en-GB', { year: 'numeric', timeZone: 'Asia/Kolkata' });
  return `${weekday}, ${day} ${month} ${year}`;
}

function venueOrLink(training) {
  return training.onlineLink || training.venue || 'To be confirmed';
}

function wrap(title, body, training) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #7a8b2e;">${title}</h2>
      ${body}
      <p>Regards,<br>HR Team<br>Brisk Olive Business Solutions Pvt. Ltd.</p>
      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <small style="color:#777; font-size:12px;">Training ID: ${training._id}</small>
    </div>
  `;
}

// ── 2-week prior notice ─────────────────────────────────────────────────────
function reminder2Weeks(training) {
  const title = `Upcoming Training Scheduled – ${training.trainingName || 'Training Session'}`;
  const body = `
    <p>Dear Team,</p>
    <p>This is to inform you that the following training session has been scheduled:</p>
    <ul style="list-style:none; padding-left:0;">
      <li><strong>Training Topic:</strong> ${training.trainingName || '-'}</li>
      <li><strong>Trainer:</strong> ${training.trainerName || 'TBD'}</li>
      <li><strong>Date & Time:</strong> ${formatDateWithWeekday(training.trainingDate) || 'TBD'}${training.startTime ? `, ${training.startTime} – ${training.endTime}` : ''}</li>
      <li><strong>Venue / Link:</strong> ${venueOrLink(training)}</li>
    </ul>
    <p>This is a two-week prior intimation. Further reminders will follow closer to the date.</p>
  `;
  return { subject: title, html: wrap(title, body, training) };
}

// ── 1-week invitation ────────────────────────────────────────────────────────
function invitation1Week(training) {
  const title = `Invitation for Training: ${training.trainingName || 'Training Session'}`;
  const body = `
    <p>Dear Team,</p>
    <p>The upcoming training session is scheduled as per the training plan.</p>
    <p><strong>Training Details:</strong></p>
    <ul style="list-style:none; padding-left:0;">
      <li>• <strong>Topic:</strong> ${training.trainingName || '-'}</li>
      <li>• <strong>Trainer:</strong> ${training.trainerName || 'TBD'}</li>
      <li>• <strong>Date & Time:</strong> ${formatDateWithWeekday(training.trainingDate) || 'TBD'}${training.startTime ? `, ${training.startTime} – ${training.endTime}` : ''}</li>
      <li>• <strong>Venue / Link:</strong> ${venueOrLink(training)}</li>
      ${training.contentPdfLink ? `<li>• <strong>Training Material:</strong> <a href="${training.contentPdfLink}">Link</a></li>` : ''}
    </ul>
    <p>Kindly ensure your availability and active participation. Your attendance is essential for successful completion of the training.</p>
  `;
  return { subject: title, html: wrap(title, body, training) };
}

// ── 1-week material-upload reminder (to the trainer) ────────────────────────
function materialUploadReminder(training) {
  const title = `Upload Training Material – ${training.trainingName || 'Training Session'}`;
  const body = `
    <p>Dear ${training.trainerName || 'Trainer'},</p>
    <p>Thank you for agreeing to conduct the training session on <strong>${training.trainingName || 'the scheduled topic'}</strong>.</p>
    <p>To support our training documentation, please share/upload the materials you'll be presenting, such as:</p>
    <ul>
      <li>Presentation (PPT/PDF)</li>
      <li>Assessment/Test links</li>
      <li>Reference documents</li>
    </ul>
    <p>This helps us maintain proper records and ensure compliance with internal audit requirements.</p>
  `;
  return { subject: title, html: wrap(title, body, training) };
}

// ── Post-training feedback mail ─────────────────────────────────────────────
// Sent manually once the training is done. Links to the standalone feedback
// page and states when the feedback window closes (feedbackWindow hours after
// the training ends) — HR can edit all of this in the popup before sending.
function feedbackReminder(training) {
  const title = `Mandatory Training Feedback – ${training.trainingName || 'Training Session'}`;
  // Standalone, login-free page (no dashboard) — the signed link is what lets
  // an employee open this training's form.
  const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/training-feedback/${training._id}?sig=${signTrainingFeedback(training._id)}`;
  const closes = feedbackClosesAt(training);
  const windowLine = closes
    ? `<p><strong>Please submit your feedback by ${fmtIst(closes)} (IST)</strong> — the feedback window is open for ${training.feedbackWindow} hours after the session and closes after that.</p>`
    : '';
  const body = `
    <p>Dear Participant,</p>
    <p>Thank you for attending the training session on <strong>${training.trainingName || 'the scheduled topic'}</strong>.</p>
    <p>As part of our learning evaluation process, we request you to submit your feedback.</p>
    ${windowLine}
    <p><a href="${link}" style="display:inline-block; padding:10px 18px; background:#7a8b2e; color:#fff; text-decoration:none; border-radius:6px;">Give Feedback</a></p>
        <p><strong>Important:</strong> Feedback submission is considered as attendance confirmation.</p>
    <p>Your honest feedback helps us improve training quality and effectiveness.</p>
  `;
  return { subject: title, html: wrap(title, body, training) };
}

module.exports = { reminder2Weeks, invitation1Week, materialUploadReminder, feedbackReminder };
