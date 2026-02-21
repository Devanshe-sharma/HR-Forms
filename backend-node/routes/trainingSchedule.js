const express = require('express');
const router = express.Router();
const TrainingSchedule = require('../models/TrainingSchedule');
const TrainingSuggestion = require('../models/TrainingSuggestion');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const { approvalStatus, trainerId, employeeId } = req.query;
  const filter = {};
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (trainerId) filter.trainerId = trainerId;
  if (employeeId) filter.assignedEmployees = employeeId;

  const list = await TrainingSchedule.find(filter)
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .sort({ startDate: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/pending', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const list = await TrainingSchedule.find({ approvalStatus: 'Pending' })
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const doc = await TrainingSchedule.findById(req.params.id)
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: doc });
}));

router.post('/', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const { trainingSuggestionId, topics, startDate, endDate, trainerId, assignedEmployees, createdBy } = req.body || {};
  if (!trainingSuggestionId) return res.status(400).json({ success: false, error: 'Training suggestion is required' });
  if (!startDate || !endDate) return res.status(400).json({ success: false, error: 'Start date and end date are required' });

  const doc = await TrainingSchedule.create({
    trainingSuggestionId,
    topics: Array.isArray(topics) ? topics.map(x => String(x).trim()).filter(Boolean) : [],
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    trainerId: trainerId || null,
    assignedEmployees: Array.isArray(assignedEmployees) ? assignedEmployees : [],
    status: 'Scheduled',
    approvalStatus: 'Pending',
    createdBy: createdBy || null,
  });
  const populated = await TrainingSchedule.findById(doc._id)
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .lean();
  res.status(201).json({ success: true, data: populated || doc });
}));

router.patch('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.topics != null) updates.topics = Array.isArray(req.body.topics) ? req.body.topics.map(x => String(x).trim()).filter(Boolean) : [];
  if (req.body.startDate != null) updates.startDate = new Date(req.body.startDate);
  if (req.body.endDate != null) updates.endDate = new Date(req.body.endDate);
  if (req.body.trainerId != null) updates.trainerId = req.body.trainerId;
  if (req.body.assignedEmployees != null) updates.assignedEmployees = Array.isArray(req.body.assignedEmployees) ? req.body.assignedEmployees : [];
  if (req.body.status != null) updates.status = ['Scheduled', 'Completed', 'Cancelled'].includes(req.body.status) ? req.body.status : undefined;

  const doc = await TrainingSchedule.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: doc });
}));

router.post('/:id/approve', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const doc = await TrainingSchedule.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: 'Approved' },
    { new: true }
  )
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: doc });
}));

router.post('/:id/reject', requireRole(['Admin', 'Management']), asyncHandler(async (req, res) => {
  const doc = await TrainingSchedule.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: 'Rejected', status: 'Cancelled' },
    { new: true }
  )
    .populate('trainingSuggestionId')
    .populate('trainerId', 'full_name department designation official_email')
    .populate('assignedEmployees', 'full_name department designation official_email')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const doc = await TrainingSchedule.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Training schedule not found' });
  res.json({ success: true });
}));

module.exports = router;
