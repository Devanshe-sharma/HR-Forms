const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');
const CapabilityArea = require('../models/CapabilityArea');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);


async function getNextCapabilityAreaId() {
  const last = await CapabilityArea.findOne().sort({ createdAt: -1 }).select('capabilityAreaId');
  if (!last?.capabilityAreaId) return 'CA001';
  const num = parseInt(last.capabilityAreaId.replace('CA', ''), 10);
  return isNaN(num) ? '001' : `${String(num + 1).padStart(3, '0')}`;
}
// GET all capability areas
router.get('/', requireRole(['Admin', 'HR', 'Management', 'HeadOfDepartment', 'Trainer', 'Employee']), asyncHandler(async (req, res) => {
  const areas = await CapabilityArea.find().sort({ createdAt: -1 });
  res.json({ success: true, data: areas });
}));

// GET single capability area
router.get('/:id', requireRole(['Admin', 'HR', 'Management']), asyncHandler(async (req, res) => {
  const area = await CapabilityArea.findById(req.params.id);
  if (!area) return res.status(404).json({ success: false, error: 'Capability area not found' });
  res.json({ success: true, data: area });
}));

// POST create capability area
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityArea, createdBy } = req.body || {};
  if (!capabilityArea || !String(capabilityArea).trim()) {
    return res.status(400).json({ success: false, error: 'Capability area is required' });
  }
  const capabilityAreaId = await getNextCapabilityAreaId();
  const newArea = await CapabilityArea.create({
    capabilityAreaId,
    capabilityArea: String(capabilityArea).trim(),
    createdBy: createdBy || req.headers['x-user-role'] || 'System',
  });
  res.status(201).json({ success: true, data: newArea });
}));

// PATCH update capability area
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityAreaId, capabilityArea } = req.body || {};
  const updates = {
    ...(capabilityAreaId && { capabilityAreaId }),
    ...(capabilityArea && { capabilityArea: String(capabilityArea).trim() }),
  };

  const updated = await CapabilityArea.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!updated) return res.status(404).json({ success: false, error: 'Capability area not found' });
  res.json({ success: true, data: updated });
}));

// DELETE capability area
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const deleted = await CapabilityArea.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Capability area not found' });
  res.json({ success: true });
}));

module.exports = router;