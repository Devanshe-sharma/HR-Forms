const express = require('express');
const router = express.Router();
const { RoleTargets } = require('../models/pmsModels');
const asyncHandler = require('express-async-handler');

// Helper function to calculate score based on gap
const calculateScore = (achieved, target) => {
  if (achieved >= target) return 0;
  const gap = target - achieved;
  
  if (gap < 100) return -gap;
  if (gap < 1000) return -(gap / 10);
  if (gap < 10000) return -(gap / 100);
  return -(gap / 1000);
};

// GET /api/role-targets - Get all role targets
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { role, employeeId } = req.query;
    let query = {};
    if (role) query.role = role;
    if (employeeId) query.employeeId = employeeId;

    const roleTargets = await RoleTargets.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: roleTargets,
      message: 'Role targets retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching role targets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role targets',
      error: error.message
    });
  }
}));

// POST /api/role-targets - Add new role target
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { name, role, employeeId, targetValue, achievedValue } = req.body;
    
    const score = calculateScore(achievedValue || 0, targetValue);
    
    const roleTarget = new RoleTargets({
      name,
      role,
      employeeId,
      targetValue,
      achievedValue: achievedValue || 0,
      score
    });

    await roleTarget.save();
    res.status(201).json({
      success: true,
      data: roleTarget,
      message: 'Role target created successfully'
    });
  } catch (error) {
    console.error('Error creating role target:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating role target',
      error: error.message
    });
  }
}));

module.exports = router;
