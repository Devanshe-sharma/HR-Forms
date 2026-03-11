const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');
const CapabilitySkill = require('../models/capabilitySkill');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET all capability skills
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const { capabilityId } = req.query;
  const filter = capabilityId ? { capabilityId } : {};
  const skills = await CapabilitySkill.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: skills });
}));

// GET single capability skill
router.get('/:id', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const skill = await CapabilitySkill.findById(req.params.id);
  if (!skill) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  res.json({ success: true, data: skill });
}));

// POST create capability skill
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityId, capabilitySkill, isGeneric, capabilityArea, createdBy } = req.body || {};

  if (!capabilityId) {
    return res.status(400).json({ success: false, error: 'Capability ID is required' });
  }
  if (!capabilitySkill || !String(capabilitySkill).trim()) {
    return res.status(400).json({ success: false, error: 'Capability skill is required' });
  }

  const newSkill = await CapabilitySkill.create({
    capabilityId: String(capabilityId),
    capabilitySkill: String(capabilitySkill).trim(),
    isGeneric: Boolean(isGeneric),
    capabilityArea: String(capabilityArea || ''),
    createdBy: createdBy || req.headers['x-user-role'] || 'System',
  });

  res.status(201).json({ success: true, data: newSkill });
}));

// PATCH update capability skill
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityId, capabilitySkill, isGeneric, capabilityArea } = req.body || {};
  const updates = {
    ...(capabilityId && { capabilityId: String(capabilityId) }),
    ...(capabilitySkill && { capabilitySkill: String(capabilitySkill).trim() }),
    ...(isGeneric !== undefined && { isGeneric: Boolean(isGeneric) }),
    ...(capabilityArea && { capabilityArea: String(capabilityArea) }),
  };

  const updated = await CapabilitySkill.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  res.json({ success: true, data: updated });
}));

// DELETE capability skill
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const deleted = await CapabilitySkill.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  res.json({ success: true });
}));

module.exports = router;