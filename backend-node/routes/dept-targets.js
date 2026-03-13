const express = require('express');
const router = express.Router();
const { DeptTargets } = require('../models/pmsModels');

// Helper function to calculate score based on gap
const calculateScore = (achieved, target) => {
  if (achieved >= target) return 0;
  const gap = target - achieved;
  
  if (gap < 100) return -gap;
  if (gap < 1000) return -(gap / 10);
  if (gap < 10000) return -(gap / 100);
  return -(gap / 1000);
};

// GET all department targets
router.get('/', async (req, res) => {
  try {
    const targets = await DeptTargets.find();
    res.json({ success: true, data: targets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET department targets by department
router.get('/department/:department', async (req, res) => {
  try {
    const targets = await DeptTargets.find({ department: req.params.department });
    res.json({ success: true, data: targets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST new department target
router.post('/', async (req, res) => {
  try {
    const { name, department, targetValue, achievedValue } = req.body;
    
    // Calculate score based on gap
    const score = calculateScore(achievedValue || 0, targetValue);
    
    const target = new DeptTargets({
      name,
      department,
      targetValue,
      achievedValue: achievedValue || 0,
      score
    });

    await target.save();
    res.status(201).json({
      success: true,
      data: target,
      message: 'Department target created successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update department target
router.put('/:id', async (req, res) => {
  try {
    const { name, department, targetValue, achievedValue } = req.body;
    
    const target = await DeptTargets.findByIdAndUpdate(
      req.params.id,
      { name, department, targetValue, achievedValue },
      { new: true, runValidators: true }
    );

    if (!target) {
      return res.status(404).json({ success: false, message: 'Department target not found' });
    }

    res.json({
      success: true,
      data: target,
      message: 'Department target updated successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE department target
router.delete('/:id', async (req, res) => {
  try {
    const target = await DeptTargets.findByIdAndDelete(req.params.id);
    
    if (!target) {
      return res.status(404).json({ success: false, message: 'Department target not found' });
    }

    res.json({
      success: true,
      message: 'Department target deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
