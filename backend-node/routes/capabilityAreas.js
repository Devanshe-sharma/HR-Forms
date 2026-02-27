const express = require('express');
const router = express.Router();
const { requireRole } = require('../config/roles');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Debug logging
console.log('🔧 Capability Areas routes loaded');

// In-memory storage for capability areas (replace with actual model later)
let capabilityAreas = [];

// GET all capability areas
router.get('/', requireRole(['Admin', 'HR', 'Management']), asyncHandler(async (req, res) => {
  console.log('📡 GET /capability-areas called');
  res.json({ success: true, data: capabilityAreas });
}));

// GET single capability area
router.get('/:id', requireRole(['Admin', 'HR', 'Management']), asyncHandler(async (req, res) => {
  const area = capabilityAreas.find(a => a._id === req.params.id);
  if (!area) return res.status(404).json({ success: false, error: 'Capability area not found' });
  res.json({ success: true, data: area });
}));

// POST create capability area
router.post('/', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const { capabilityAreaId, capabilityArea, createdBy } = req.body || {};
  if (!capabilityArea || !String(capabilityArea).trim()) {
    return res.status(400).json({ success: false, error: 'Capability area is required' });
  }
  
  const newArea = {
    _id: Date.now().toString(),
    capabilityAreaId: capabilityAreaId || 'CA' + Date.now().toString().slice(-8),
    capabilityArea: String(capabilityArea).trim(),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || 'System',
  };
  
  capabilityAreas.push(newArea);
  res.status(201).json({ success: true, data: newArea });
}));

// PATCH update capability area
router.patch('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = capabilityAreas.findIndex(a => a._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Capability area not found' });
  
  const { capabilityAreaId, capabilityArea } = req.body || {};
  capabilityAreas[index] = {
    ...capabilityAreas[index],
    ...(capabilityAreaId && { capabilityAreaId }),
    ...(capabilityArea && { capabilityArea: String(capabilityArea).trim() }),
  };
  
  res.json({ success: true, data: capabilityAreas[index] });
}));

// DELETE capability area
router.delete('/:id', requireRole(['Admin', 'HR']), asyncHandler(async (req, res) => {
  const index = capabilityAreas.findIndex(a => a._id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Capability area not found' });
  
  capabilityAreas.splice(index, 1);
  res.json({ success: true });
}));

module.exports = router;
