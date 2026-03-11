const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');
const TrainingSchedule = require('../models/TrainingSchedule');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET all training schedules
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const schedules = await TrainingSchedule.find().sort({ createdAt: -1 });
  res.json({ success: true, data: schedules });
}));

// GET single training schedule
router.get('/:id', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const schedule = await TrainingSchedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: schedule });
}));

// POST create training schedule
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
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
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const allowed = ['trainingName', 'capabilityArea', 'capabilitySkill', 'trainerName', 'type',
    'trainingDate', 'startTime', 'endTime', 'venue', 'onlineLink', 'targetAudience',
    'attendanceRequired', 'maxAttempts', 'feedbackWindow'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  const updated = await TrainingSchedule.findByIdAndUpdate(req.params.id, filtered, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: updated });
}));

// DELETE training schedule
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const deleted = await TrainingSchedule.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true });
}));

// PATCH update status
router.patch('/:id/status', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const valid = ['Scheduled', 'Rescheduled', 'Cancelled', 'Completed'];
  if (!status || !valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

  const updated = await TrainingSchedule.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: updated });
}));

module.exports = router;