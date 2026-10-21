// Matches the exact wording HR provided for the training-scheduled notice —
// sent manually (preview, then explicit Send) from the Final Training
// Scheduling tab, one training at a time.
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

function trainingScheduleNotificationTemplate(training) {
  const dateStr = formatDateWithWeekday(training.trainingDate) || '-';
  const timeStr = training.startTime && training.endTime
    ? `${training.startTime} – ${training.endTime}`
    : '-';
  const venueOrMode = training.onlineLink || training.venue || '-';
  const pptLink = training.contentPdfLink
    ? `<a href="${training.contentPdfLink}">Link</a>`
    : '[Insert PPT Link]';

  const html = `
    <p>Hi All,</p>
    <p>Please be informed that a training session has been scheduled as per the details below.</p>

    <p style="margin-bottom:4px;"><strong>Training Details</strong></p>
    <table style="border-collapse:collapse;">
      <tbody>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Topic:</strong></td><td style="padding:2px 0;">${training.trainingName || '[Training Topic]'}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Date:</strong></td><td style="padding:2px 0;">${dateStr}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Time:</strong></td><td style="padding:2px 0;">${timeStr}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Trainer:</strong></td><td style="padding:2px 0;">${training.trainerName || '[Trainer Name]'}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Venue/Mode:</strong></td><td style="padding:2px 0;">${venueOrMode}</td></tr>
        <tr><td style="padding:2px 8px 2px 0;"><strong>Training Material/ PPT:</strong></td><td style="padding:2px 0;">${pptLink}</td></tr>
      </tbody>
    </table>

    <p>All participants are requested to review the shared PPT before the session to gain a basic understanding of the topic and make the training more interactive and beneficial.</p>

    <p>Attendance is expected from all concerned participants. Kindly ensure your availability and join the session on time.</p>

    <p>Regards,<br>HR Team<br>Brisk Olive Business Solutions Pvt. Ltd.</p>
  `;

  return {
    subject: `Training Scheduled: ${training.trainingName || 'Training Session'}`,
    html,
  };
}

module.exports = trainingScheduleNotificationTemplate;
