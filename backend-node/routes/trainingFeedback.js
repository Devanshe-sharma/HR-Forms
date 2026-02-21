const express = require('express');
const router = express.Router();
const TrainingFeedback = require('../models/TrainingFeedback');
const TrainingSchedule = require('../models/TrainingSchedule');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const FEEDBACK_WINDOW_HOURS = 5;

function canSubmitFeedback(schedule) {
  if (!schedule || schedule.status !== 'Completed') return false;
  const end = new Date(schedule.endDate).getTime();
  const now = Date.now();
  const windowEnd = end + FEEDBACK_WINDOW_HOURS * 60 * 60 * 1000;
  return now <= windowEnd;
}

router.get('/', requireRole(['Admin', 'Employee', 'HR', 'HeadOfDepartment', 'Management', 'Trainer']), asyncHandler(async (req, res) => {
  const { trainingScheduleId, employeeId } = req.query;
  const filter = {};
  if (trainingScheduleId) filter.trainingScheduleId = trainingScheduleId;
  if (employeeId) filter.employeeId = employeeId;

  const list = await TrainingFeedback.find(filter)
    .populate('trainingScheduleId')
    .populate('employeeId', 'full_name department designation official_email')
    .sort({ submittedAt: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/can-submit/:trainingScheduleId', requireRole(['Admin', 'Employee']), asyncHandler(async (req, res) => {
  const schedule = await TrainingSchedule.findById(req.params.trainingScheduleId).lean();
  if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
  res.json({ success: true, canSubmit: canSubmitFeedback(schedule) });
}));

router.post('/', requireRole(['Admin', 'Employee']), asyncHandler(async (req, res) => {
  const { trainingScheduleId, employeeId, rating, comments } = req.body || {};
  if (!trainingScheduleId || !employeeId) {
    return res.status(400).json({ success: false, error: 'Training schedule and employee are required' });
  }
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Rating 1–5 is required' });
  }

  const schedule = await TrainingSchedule.findById(trainingScheduleId).lean();
  if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
  if (!canSubmitFeedback(schedule)) {
    return res.status(400).json({
      success: false,
      error: 'Feedback is only allowed when training status is Completed and within 5 hours of end time',
    });
  }

  const existing = await TrainingFeedback.findOne({ trainingScheduleId, employeeId });
  if (existing) {
    return res.status(400).json({ success: false, error: 'Feedback already submitted for this training' });
  }

  const doc = await TrainingFeedback.create({
    trainingScheduleId,
    employeeId,
    rating: Number(rating),
    comments: String(comments || '').trim(),
  });
  const populated = await TrainingFeedback.findById(doc._id)
    .populate('trainingScheduleId')
    .populate('employeeId', 'full_name department designation official_email')
    .lean();
  res.status(201).json({ success: true, data: populated || doc });
}));

module.exports = router;
