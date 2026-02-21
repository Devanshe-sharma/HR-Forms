const express = require('express');
const router = express.Router();
const TrainingMaterial = require('../models/TrainingMaterial');
const TrainingSchedule = require('../models/TrainingSchedule');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireRole(['Admin', 'Trainer', 'HR', 'HeadOfDepartment', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const { trainingScheduleId } = req.query;
  const filter = trainingScheduleId ? { trainingScheduleId } : {};
  const list = await TrainingMaterial.find(filter)
    .populate('trainingScheduleId')
    .populate('assessmentId')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/:id', requireRole(['Admin', 'Trainer', 'HR', 'HeadOfDepartment', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const doc = await TrainingMaterial.findById(req.params.id)
    .populate('trainingScheduleId')
    .populate('assessmentId')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training material not found' });
  res.json({ success: true, data: doc });
}));

router.post('/', requireRole(['Admin', 'Trainer']), asyncHandler(async (req, res) => {
  const { trainingScheduleId, contentFile, videoUrl, assessmentId, uploadedBy } = req.body || {};
  if (!trainingScheduleId) return res.status(400).json({ success: false, error: 'Training schedule is required' });

  const doc = await TrainingMaterial.create({
    trainingScheduleId,
    contentFile: String(contentFile || '').trim(),
    videoUrl: String(videoUrl || '').trim(),
    assessmentId: assessmentId || null,
    uploadedBy: uploadedBy || null,
  });
  const populated = await TrainingMaterial.findById(doc._id)
    .populate('trainingScheduleId')
    .populate('assessmentId')
    .lean();
  res.status(201).json({ success: true, data: populated || doc });
}));

router.patch('/:id', requireRole(['Admin', 'Trainer']), asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.contentFile != null) updates.contentFile = String(req.body.contentFile).trim();
  if (req.body.videoUrl != null) updates.videoUrl = String(req.body.videoUrl).trim();
  if (req.body.assessmentId != null) updates.assessmentId = req.body.assessmentId;

  const doc = await TrainingMaterial.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('trainingScheduleId')
    .populate('assessmentId')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training material not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/:id', requireRole(['Admin', 'Trainer']), asyncHandler(async (req, res) => {
  const doc = await TrainingMaterial.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Training material not found' });
  res.json({ success: true });
}));

module.exports = router;
