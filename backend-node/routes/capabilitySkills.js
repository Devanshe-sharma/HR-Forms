const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// In-memory storage for capability skills (replace with actual model later)
let capabilitySkills = [];

// GET all capability skills
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  res.json({ success: true, data: capabilitySkills });
}));

// GET single capability skill
router.get('/:id', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const skill = capabilitySkills.find(s => s._id === req.params.id);
  if (!skill) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  res.json({ success: true, data: skill });
}));

// POST create capability skill
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  console.log('📡 POST /capability-skills called');
  console.log('👤 User role:', req.role || req.headers['x-user-role']);
  const { capabilityId, capabilitySkill, isGeneric, capabilityArea, createdBy } = req.body || {};
  if (!capabilityId) {
    return res.status(400).json({ success: false, error: 'Capability ID is required' });
  }
  if (!capabilitySkill || !String(capabilitySkill).trim()) {
    return res.status(400).json({ success: false, error: 'Capability skill is required' });
  }
  
  const newSkill = {
    _id: Date.now().toString(),
    capabilityId: String(capabilityId),
    capabilitySkill: String(capabilitySkill).trim(),
    isGeneric: Boolean(isGeneric),
    capabilityArea: String(capabilityArea || ''),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'System',
  };
  
  capabilitySkills.push(newSkill);
  res.status(201).json({ success: true, data: newSkill });
}));

// PATCH update capability skill
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = capabilitySkills.findIndex(s => s._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  
  const { capabilityId, capabilitySkill, isGeneric, capabilityArea } = req.body || {};
  capabilitySkills[index] = {
    ...capabilitySkills[index],
    ...(capabilityId && { capabilityId: String(capabilityId) }),
    ...(capabilitySkill && { capabilitySkill: String(capabilitySkill).trim() }),
    ...(isGeneric !== undefined && { isGeneric: Boolean(isGeneric) }),
    ...(capabilityArea && { capabilityArea: String(capabilityArea) }),
  };
  
  res.json({ success: true, data: capabilitySkills[index] });
}));

// DELETE capability skill
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = capabilitySkills.findIndex(s => s._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Capability skill not found' });
  
  capabilitySkills.splice(index, 1);
  res.json({ success: true });
}));

module.exports = router;
