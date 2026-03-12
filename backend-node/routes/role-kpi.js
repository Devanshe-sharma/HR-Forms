const express = require('express');
const router = express.Router();
const { RoleKPI } = require('../models/pmsModels');
const asyncHandler = require('express-async-handler');

// Helper function to calculate score
const calculateScore = (achieved, target) => {
  if (target === 0) return 0;
  return Math.min(100, (achieved / target) * 100);
};

// GET /api/role-kpi - Get all role KPIs
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { role, employeeId } = req.query;
    let query = {};
    if (role) query.role = role;
    if (employeeId) query.employeeId = employeeId;

    const roleKPIs = await RoleKPI.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: roleKPIs,
      message: 'Role KPIs retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching role KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching role KPIs',
      error: error.message
    });
  }
}));

// POST /api/role-kpi - Add new role KPI
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { name, role, employeeId, targetValue, achievedValue } = req.body;
    
    const score = calculateScore(achievedValue || 0, targetValue);
    
    const roleKPI = new RoleKPI({
      name,
      role,
      employeeId,
      targetValue,
      achievedValue: achievedValue || 0,
      score
    });

    await roleKPI.save();
    res.status(201).json({
      success: true,
      data: roleKPI,
      message: 'Role KPI created successfully'
    });
  } catch (error) {
    console.error('Error creating role KPI:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating role KPI',
      error: error.message
    });
  }
}));

// PUT /api/role-kpi/:id - Update role KPI
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const { targetValue, achievedValue } = req.body;
    
    const roleKPI = await RoleKPI.findById(req.params.id);
    if (!roleKPI) {
      return res.status(404).json({
        success: false,
        message: 'Role KPI not found'
      });
    }

    if (targetValue !== undefined) roleKPI.targetValue = targetValue;
    if (achievedValue !== undefined) roleKPI.achievedValue = achievedValue;
    
    roleKPI.score = calculateScore(roleKPI.achievedValue, roleKPI.targetValue);
    roleKPI.updatedAt = new Date();
    
    await roleKPI.save();
    res.status(200).json({
      success: true,
      data: roleKPI,
      message: 'Role KPI updated successfully'
    });
  } catch (error) {
    console.error('Error updating role KPI:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating role KPI',
      error: error.message
    });
  }
}));

module.exports = router;
