const express = require('express');
const router = express.Router();
const SalaryRevision = require('../models/SalaryRevision');
const Employee = require('../models/Employee');
const asyncHandler = require('express-async-handler');

// GET /api/salary-revisions - Get all salary revisions
router.get('/', asyncHandler(async (req, res) => {
  try {
    const revisions = await SalaryRevision.find()
      .sort({ created_at: -1 });
    
    res.status(200).json({
      success: true,
      data: revisions,
      message: 'Salary revisions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching salary revisions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary revisions',
      error: error.message
    });
  }
}));

// GET /api/salary-revisions/:id - Get salary revision by ID
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const revision = await SalaryRevision.findById(req.params.id)
      .populate('employee_id', 'employee_id full_name department designation email');
    
    if (!revision) {
      return res.status(404).json({
        success: false,
        message: 'Salary revision not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: revision,
      message: 'Salary revision retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching salary revision:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary revision',
      error: error.message
    });
  }
}));

// POST /api/salary-revisions - Create new salary revision
router.post('/', asyncHandler(async (req, res) => {
  try {
    const revisionData = {
      ...req.body,
      created_by: req.headers['x-user-name'] || 'System'
    };
    
    const revision = new SalaryRevision(revisionData);
    await revision.save();
    
    res.status(201).json({
      success: true,
      data: revision,
      message: 'Salary revision created successfully'
    });
  } catch (error) {
    console.error('Error creating salary revision:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating salary revision',
      error: error.message
    });
  }
}));

// PUT /api/salary-revisions/:id - Update salary revision
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updated_by: req.headers['x-user-name'] || 'System',
      updated_at: new Date()
    };
    
    const revision = await SalaryRevision.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!revision) {
      return res.status(404).json({
        success: false,
        message: 'Salary revision not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: revision,
      message: 'Salary revision updated successfully'
    });
  } catch (error) {
    console.error('Error updating salary revision:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating salary revision',
      error: error.message
    });
  }
}));

// DELETE /api/salary-revisions/:id - Delete salary revision
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const revision = await SalaryRevision.findByIdAndDelete(req.params.id);
    
    if (!revision) {
      return res.status(404).json({
        success: false,
        message: 'Salary revision not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: revision,
      message: 'Salary revision deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting salary revision:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting salary revision',
      error: error.message
    });
  }
}));

// GET /api/salary-revisions/employee/:employeeId - Get revisions by employee
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
  try {
    const revisions = await SalaryRevision.find({ employee_id: req.params.employeeId })
      .sort({ created_at: -1 });
    
    res.status(200).json({
      success: true,
      data: revisions,
      message: 'Employee salary revisions retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching employee salary revisions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee salary revisions',
      error: error.message
    });
  }
}));

// POST /api/salary-revisions/bulk - Bulk create salary revisions
router.post('/bulk', asyncHandler(async (req, res) => {
  try {
    const { revisions } = req.body;
    
    if (!Array.isArray(revisions)) {
      return res.status(400).json({
        success: false,
        message: 'Revisions must be an array'
      });
    }
    
    const createdRevisions = await SalaryRevision.insertMany(
      revisions.map(rev => ({
        ...rev,
        created_by: req.headers['x-user-name'] || 'System'
      }))
    );
    
    res.status(201).json({
      success: true,
      data: createdRevisions,
      message: 'Bulk salary revisions created successfully'
    });
  } catch (error) {
    console.error('Error creating bulk salary revisions:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bulk salary revisions',
      error: error.message
    });
  }
}));

// GET /api/salary-revisions/stats - Get salary revision statistics
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await SalaryRevision.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const decisionStats = await SalaryRevision.aggregate([
      {
        $group: {
          _id: '$decision',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const departmentStats = await SalaryRevision.aggregate([
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          avgIncrement: { $avg: '$final_increment_percentage' }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        statusStats: stats,
        decisionStats: decisionStats,
        departmentStats: departmentStats
      },
      message: 'Salary revision statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching salary revision statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary revision statistics',
      error: error.message
    });
  }
}));

module.exports = router;
