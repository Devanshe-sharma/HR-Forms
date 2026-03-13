const express = require('express');
const router = express.Router();
const { DeptKPI } = require('../models/pmsModels');
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

// GET /api/dept-kpi - Get all department KPIs
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { department } = req.query;
    let query = {};
    if (department) {
      query.department = department;
    }

    const deptKPIs = await DeptKPI.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: deptKPIs,
      message: 'Department KPIs retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching department KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department KPIs',
      error: error.message
    });
  }
}));

// POST /api/dept-kpi - Add new department KPI
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { name, department, targetValue, achievedValue } = req.body;
    
    // Calculate score based on gap
    const score = calculateScore(achievedValue || 0, targetValue);
    
    const deptKPI = new DeptKPI({
      name,
      department,
      targetValue,
      achievedValue: achievedValue || 0,
      score
    });

    await deptKPI.save();
    res.status(201).json({
      success: true,
      data: deptKPI,
      message: 'Department KPI created successfully'
    });
  } catch (error) {
    console.error('Error creating department KPI:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating department KPI',
      error: error.message
    });
  }
}));

// PUT /api/dept-kpi/:id - Update department KPI
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const { targetValue, achievedValue } = req.body;
    
    const deptKPI = await DeptKPI.findById(req.params.id);
    if (!deptKPI) {
      return res.status(404).json({
        success: false,
        message: 'Department KPI not found'
      });
    }

    if (targetValue !== undefined) deptKPI.targetValue = targetValue;
    if (achievedValue !== undefined) deptKPI.achievedValue = achievedValue;
    
    deptKPI.score = calculateScore(deptKPI.achievedValue, deptKPI.targetValue);
    deptKPI.updatedAt = new Date();
    
    await deptKPI.save();
    res.status(200).json({
      success: true,
      data: deptKPI,
      message: 'Department KPI updated successfully'
    });
  } catch (error) {
    console.error('Error updating department KPI:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating department KPI',
      error: error.message
    });
  }
}));

module.exports = router;
