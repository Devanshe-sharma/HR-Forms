const express = require('express');
const router = express.Router();
const { DeptTargets } = require('../models/pmsModels');
const asyncHandler = require('express-async-handler');

// Helper function to calculate score
const calculateScore = (achieved, target) => {
  if (target === 0) return 0;
  return Math.min(100, (achieved / target) * 100);
};

// GET /api/dept-targets - Get all department targets
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { department } = req.query;
    let query = {};
    if (department) {
      query.department = department;
    }

    const deptTargets = await DeptTargets.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: deptTargets,
      message: 'Department targets retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching department targets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department targets',
      error: error.message
    });
  }
}));

// POST /api/dept-targets - Add new department target
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { name, department, targetValue, achievedValue } = req.body;
    
    const score = calculateScore(achievedValue || 0, targetValue);
    
    const deptTarget = new DeptTargets({
      name,
      department,
      targetValue,
      achievedValue: achievedValue || 0,
      score
    });

    await deptTarget.save();
    res.status(201).json({
      success: true,
      data: deptTarget,
      message: 'Department target created successfully'
    });
  } catch (error) {
    console.error('Error creating department target:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating department target',
      error: error.message
    });
  }
}));

module.exports = router;
