const express = require('express');
const router = express.Router();
const TrainingSchedule = require('../models/TrainingSchedule');
const { sendMail } = require('../emails/mailer');
const buildTrainingScheduleNotification = require('../emails/templates/trainingScheduleNotification');
const trainingReminderMails = require('../emails/templates/trainingReminderMails');
const { feedbackClosesAt } = require('../utils/trainingFeedbackWindow');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const DEFAULT_ALL_EMPLOYEES_EMAIL = process.env.ALL_EMPLOYEES_EMAIL || 'all@briskolive.com';

// Training is open to every logged-in role — no requireRole gate here.
// GET all training schedules
// Adds the computed feedback window end so the UI doesn't have to re-derive it.
const withFeedbackWindow = doc => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const closes = feedbackClosesAt(obj);
  return { ...obj, feedbackClosesAt: closes ? closes.toISOString() : null };
};

// Optional ?status=Completed (etc.) filter.
router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  const schedules = await TrainingSchedule.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: schedules.map(withFeedbackWindow) });
}));

// GET single training schedule
router.get('/:id', asyncHandler(async (req, res) => {
  const schedule = await TrainingSchedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: withFeedbackWindow(schedule) });
}));

// POST create training schedule
router.post('/', asyncHandler(async (req, res) => {
  const {
    trainingId, trainingName, capabilityArea, capabilitySkill, trainerName,
    type, trainingDate, startTime, endTime, venue, onlineLink,
    targetAudience, attendanceRequired, maxAttempts, feedbackWindow, createdBy
  } = req.body || {};

  if (!trainingName?.trim()) return res.status(400).json({ success: false, error: 'Training name is required' });
  if (!trainingDate) return res.status(400).json({ success: false, error: 'Training date is required' });
  if (!startTime) return res.status(400).json({ success: false, error: 'Start time is required' });
  if (!endTime) return res.status(400).json({ success: false, error: 'End time is required' });
  if (!venue?.trim() && !onlineLink?.trim()) return res.status(400).json({ success: false, error: 'Either venue or online link is required' });
  if (!targetAudience?.type) return res.status(400).json({ success: false, error: 'Target audience is required' });

  const newSchedule = await TrainingSchedule.create({
    trainingId: trainingId || '',
    trainingName: trainingName.trim(),
    capabilityArea: capabilityArea || '',
    capabilitySkill: capabilitySkill || '',
    trainerName: trainerName?.trim() || '',
    type: type || 'Generic',
    trainingDate,
    startTime,
    endTime,
    venue: venue?.trim() || '',
    onlineLink: onlineLink?.trim() || '',
    targetAudience: {
      type: targetAudience.type,
      departments: targetAudience.departments || [],
      levels: targetAudience.levels || [],
      roles: targetAudience.roles || [],
    },
    attendanceRequired: attendanceRequired !== false,
    maxAttempts: Number(maxAttempts) || 2,
    feedbackWindow: Number(feedbackWindow) || 5,
    createdBy: createdBy || req.headers['x-user-role'] || 'System',
  });

  res.status(201).json({ success: true, data: newSchedule });
}));

// PATCH update training schedule
router.patch('/:id', asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const allowed = ['trainingName', 'capabilityArea', 'capabilitySkill', 'trainerName', 'type',
    'trainingDate', 'startTime', 'endTime', 'venue', 'onlineLink', 'targetAudience',
    'attendanceRequired', 'maxAttempts', 'feedbackWindow',
    'contentPdfLink', 'videoLink', 'assessmentLink'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const updated = await TrainingSchedule.findByIdAndUpdate(req.params.id, filtered, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: updated });
}));

// DELETE training schedule
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await TrainingSchedule.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true });
}));

// PATCH update status
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const valid = ['Scheduled', 'Rescheduled', 'Cancelled', 'Completed'];
  if (!status || !valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

  const updated = await TrainingSchedule.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: updated });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /:id/notify/:kind/preview & /:id/notify/:kind/send
// Every training mail is manual — HR reviews/edits To, CC, subject and body
// in a popup and must click Send explicitly; nothing here fires on its own
// or from a cron job. `kind` picks which of the 5 training mails to build:
//   schedule          — "Send Schedule Notification" (the exact HR-provided wording)
//   reminder2w        — 2-week prior notice
//   invitation1w      — 1-week invitation
//   materialUpload1w  — 1-week reminder to the trainer to upload material
//   feedbackReminder  — on-day mandatory feedback reminder
// Each sets its own `<kind>SentAt` field on the training (informational only,
// never blocks re-sending) so the Scheduling tab can show what's gone out.
// ─────────────────────────────────────────────────────────────────────────────
const TRAINING_MAIL_KINDS = {
  schedule:         { build: buildTrainingScheduleNotification, sentAtField: 'scheduleNotificationSentAt',     defaultsToAllAudience: true },
  reminder2w:       { build: trainingReminderMails.reminder2Weeks,         sentAtField: 'reminder2WeeksSentAt',       defaultsToAllAudience: true },
  invitation1w:     { build: trainingReminderMails.invitation1Week,        sentAtField: 'invitation1WeekSentAt',      defaultsToAllAudience: true },
  materialUpload1w: { build: trainingReminderMails.materialUploadReminder, sentAtField: 'materialUploadReminderSentAt', defaultsToAllAudience: false },
  feedbackReminder: { build: trainingReminderMails.feedbackReminder,       sentAtField: 'feedbackReminderSentAt',     defaultsToAllAudience: true },
};

router.post('/:id/notify/:kind/preview', asyncHandler(async (req, res) => {
  const spec = TRAINING_MAIL_KINDS[req.params.kind];
  if (!spec) return res.status(400).json({ success: false, error: 'Unknown mail kind' });

  const training = await TrainingSchedule.findById(req.params.id).lean();
  if (!training) return res.status(404).json({ success: false, error: 'Training schedule not found' });

  const { subject, html } = spec.build(training);
  const to = spec.defaultsToAllAudience && training.targetAudience?.type === 'all'
    ? DEFAULT_ALL_EMPLOYEES_EMAIL
    : '';

  res.json({ success: true, data: { to, cc: '', subject, body: html } });
}));

router.post('/:id/notify/:kind/send', asyncHandler(async (req, res) => {
  const spec = TRAINING_MAIL_KINDS[req.params.kind];
  if (!spec) return res.status(400).json({ success: false, error: 'Unknown mail kind' });

  const training = await TrainingSchedule.findById(req.params.id);
  if (!training) return res.status(404).json({ success: false, error: 'Training schedule not found' });

  const { to, cc, subject, customBody } = req.body || {};
  if (!to || !to.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to: to.trim(),
    cc: cc?.trim() || undefined,
    subject: subject || spec.build(training.toObject()).subject,
    html: customBody || spec.build(training.toObject()).html,
  });

  training[spec.sentAtField] = new Date();
  await training.save();

  res.json({ success: true, data: training });
}));

module.exports = router;