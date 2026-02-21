const express = require('express');
const router = express.Router();
const TrainingSuggestion = require('../models/TrainingSuggestion');
const CapabilityAssessment = require('../models/CapabilityAssessment');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const list = await TrainingSuggestion.find()
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
}));

router.get('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const doc = await TrainingSuggestion.findById(req.params.id)
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training suggestion not found' });
  res.json({ success: true, data: doc });
}));

router.post('/', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const { capabilityId, roleIds, departmentIds, trainingType, level, mandatory, topicSuggestions, selectedTopics, suggestedBy } = req.body || {};
  if (!capabilityId) return res.status(400).json({ success: false, error: 'Capability is required' });

  const normalizedType = ['Generic', 'Department', 'Level', 'MultiDept'].includes(trainingType) ? trainingType : 'Department';
  const roles = Array.isArray(roleIds) ? roleIds : (roleIds ? [roleIds] : []);
  const depts = Array.isArray(departmentIds) ? departmentIds : (departmentIds ? [departmentIds] : []);

  // score achieved: fetch from capability_assessment if possible (first matching role)
  let scoreAchieved = null;
  if (roles.length > 0) {
    const assess = await CapabilityAssessment.findOne({ capabilityId, roleId: roles[0] }).sort({ createdAt: -1 }).lean();
    if (assess?.scoreAchieved != null) scoreAchieved = Number(assess.scoreAchieved);
  }

  const doc = await TrainingSuggestion.create({
    capabilityId,
    roleIds: roles,
    departmentIds: depts,
    trainingType: normalizedType,
    level: Math.min(4, Math.max(1, Number(level) || 1)),
    mandatory: Boolean(mandatory),
    scoreAchieved,
    topicSuggestions: Array.isArray(topicSuggestions) ? topicSuggestions.map(x => String(x).trim()).filter(Boolean) : [],
    selectedTopics: Array.isArray(selectedTopics) ? selectedTopics.map(x => String(x).trim()).filter(Boolean) : [],
    suggestedBy: suggestedBy || null,
  });
  const populated = await TrainingSuggestion.findById(doc._id)
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();
  res.status(201).json({ success: true, data: populated || doc });
}));

router.patch('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.capabilityId != null) updates.capabilityId = req.body.capabilityId;
  if (req.body.roleIds != null) updates.roleIds = Array.isArray(req.body.roleIds) ? req.body.roleIds : (req.body.roleIds ? [req.body.roleIds] : []);
  if (req.body.departmentIds != null) updates.departmentIds = Array.isArray(req.body.departmentIds) ? req.body.departmentIds : (req.body.departmentIds ? [req.body.departmentIds] : []);
  if (req.body.trainingType != null) updates.trainingType = ['Generic', 'Department', 'Level', 'MultiDept'].includes(req.body.trainingType) ? req.body.trainingType : undefined;
  if (req.body.level != null) updates.level = Math.min(4, Math.max(1, Number(req.body.level) || 1));
  if (req.body.mandatory != null) updates.mandatory = Boolean(req.body.mandatory);
  if (req.body.topicSuggestions != null) updates.topicSuggestions = Array.isArray(req.body.topicSuggestions) ? req.body.topicSuggestions.map((x) => String(x).trim()).filter(Boolean) : [];
  if (req.body.selectedTopics != null) updates.selectedTopics = Array.isArray(req.body.selectedTopics) ? req.body.selectedTopics.map((x) => String(x).trim()).filter(Boolean) : [];

  const doc = await TrainingSuggestion.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('capabilityId', 'capabilityName capabilityDescription isGeneric')
    .lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Training suggestion not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment']), asyncHandler(async (req, res) => {
  const doc = await TrainingSuggestion.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Training suggestion not found' });
  res.json({ success: true });
}));

module.exports = router;
