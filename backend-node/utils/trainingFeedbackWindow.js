/**
 * backend-node/utils/trainingFeedbackWindow.js
 *
 * When feedback for a training can be logged. The window runs for
 * TrainingSchedule.feedbackWindow hours starting from the moment the
 * training ENDS (trainingDate + endTime, IST) — not from midnight of the
 * training date.
 *
 * feedbackWindow = 0 / unset means no time limit (closesAt = null).
 */

// trainingDate is stored as a "YYYY-MM-DD" string; tolerate a full ISO value.
function trainingEnd(training) {
  const day = String(training?.trainingDate || '').slice(0, 10);
  const time = /^\d{1,2}:\d{2}$/.test(training?.endTime || '') ? training.endTime.padStart(5, '0') : '23:59';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function feedbackClosesAt(training) {
  const end = trainingEnd(training);
  const hours = Number(training?.feedbackWindow) || 0;
  if (!end || hours <= 0) return null;
  return new Date(end.getTime() + hours * 3600000);
}

function isFeedbackOpen(training, now = new Date()) {
  const closes = feedbackClosesAt(training);
  return !closes || now <= closes;
}

const fmtIst = d =>
  d.toLocaleString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

module.exports = { trainingEnd, feedbackClosesAt, isFeedbackOpen, fmtIst };
