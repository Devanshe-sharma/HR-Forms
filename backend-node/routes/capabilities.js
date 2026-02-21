const express = require('express');
const router = express.Router();
const Capability = require('../models/Capability');
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const list = await Capability.find().sort({ capabilityName: 1 }).lean();
  res.json({ success: true, data: list });
}));

router.get('/:id', requireRole(['Admin', 'HR', 'HeadOfDepartment', 'Trainer', 'Management', 'Employee']), asyncHandler(async (req, res) => {
  const doc = await Capability.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success: false, error: 'Capability not found' });
  res.json({ success: true, data: doc });
}));

router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityName, capabilityDescription, isGeneric, createdBy } = req.body || {};
  if (!capabilityName || !String(capabilityName).trim()) {
    return res.status(400).json({ success: false, error: 'Capability name is required' });
  }
  const doc = await Capability.create({
    capabilityName: String(capabilityName).trim(),
    capabilityDescription: String(capabilityDescription || '').trim(),
    isGeneric: Boolean(isGeneric),
    createdBy: createdBy || null,
  });
  res.status(201).json({ success: true, data: doc });
}));

router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const doc = await Capability.findByIdAndUpdate(
    req.params.id,
    {
      ...(req.body.capabilityName != null && { capabilityName: String(req.body.capabilityName).trim() }),
      ...(req.body.capabilityDescription != null && { capabilityDescription: String(req.body.capabilityDescription).trim() }),
      ...(req.body.isGeneric != null && { isGeneric: Boolean(req.body.isGeneric) }),
    },
    { new: true, runValidators: true }
  );
  if (!doc) return res.status(404).json({ success: false, error: 'Capability not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const doc = await Capability.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Capability not found' });
  res.json({ success: true });
}));

module.exports = router;
