const express = require('express');
const router = express.Router();
const ManagerEvaluation = require('../models/ManagerEvaluation');
const Employee = require('../models/Employee');
const CapabilitySkill = require('../models/CapabilitySkill');
const CapabilityArea = require('../models/CapabilityArea');
const RequiredScoreByLevel = require('../models/RequiredScoreByLevel');
const asyncHandler = require('express-async-handler');

// GET /api/capability-evaluations - Get all manager evaluations
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { employeeId, capabilitySkillId, status, evaluatedBy, evaluationType } = req.query;
    let query = {};
    
    if (employeeId) query.employeeId = employeeId;
    if (capabilitySkillId) query.capabilitySkillId = capabilitySkillId;
    if (status) query.status = status;
    if (evaluatedBy) query.evaluatedBy = evaluatedBy;
    if (evaluationType) query.evaluationType = evaluationType;

    const evaluations = await ManagerEvaluation.find(query)
      .sort({ evaluatedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: evaluations,
      message: 'Manager evaluations retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching manager evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching manager evaluations',
      error: error.message
    });
  }
}));

// GET /api/capability-evaluations/:id - Get evaluation by ID
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const evaluation = await ManagerEvaluation.findById(req.params.id)
      .populate('capabilitySkillId', 'capabilitySkill capabilityArea');
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Manager evaluation not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: evaluation,
      message: 'Manager evaluation retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching manager evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching manager evaluation',
      error: error.message
    });
  }
}));

// POST /api/capability-evaluations - Create new manager evaluation
router.post('/', asyncHandler(async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      employeeRole,
      capabilitySkillId,
      requiredScore,
      actualScore,
      scoreReason,
      isMandatory = false,
      mandatoryReason,
      evaluatedBy,
      evaluationPeriod,
      improvementPlan,
      comments,
      evaluationType = 'Quarterly',
      performanceCategory = 'Meets Expectations',
      overallRating,
      strengths = [],
      areasForImprovement = [],
      nextPeriodGoals = []
    } = req.body;

    // Validate required fields
    if (!employeeId || !employeeName || !employeeRole || !capabilitySkillId || !requiredScore || actualScore === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: employeeId, employeeName, employeeRole, capabilitySkillId, requiredScore, actualScore'
      });
    }

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Validate capability skill exists
    let capabilitySkill;
    try {
      capabilitySkill = await CapabilitySkill.findById(capabilitySkillId);
    } catch (skillError) {
      console.log('Capability skill lookup error:', skillError.message);
      capabilitySkill = null;
    }
    
    if (!capabilitySkill) {
      return res.status(400).json({
        success: false,
        message: `Capability skill not found with ID: ${capabilitySkillId}`
      });
    }

    // Calculate gap
    const gap = actualScore - requiredScore;

    const evaluation = new ManagerEvaluation({
      employeeId,
      employeeName,
      employeeRole,
      capabilitySkillId,
      capabilitySkill: capabilitySkill.capabilitySkill,
      capabilityArea: capabilitySkill.capabilityArea,
      requiredScore,
      actualScore,
      scoreReason: scoreReason || '',
      isMandatory,
      mandatoryReason: mandatoryReason || '',
      gap,
      evaluatedBy: evaluatedBy || req.headers['x-user-role'] || 'Manager',
      evaluationPeriod: evaluationPeriod || '',
      improvementPlan: improvementPlan || '',
      comments: comments || '',
      evaluationType,
      performanceCategory,
      overallRating: overallRating || 3,
      strengths,
      areasForImprovement,
      nextPeriodGoals,
      status: 'Submitted'
    });

    await evaluation.save();

    res.status(201).json({
      success: true,
      data: evaluation,
      message: 'Manager evaluation created successfully'
    });
  } catch (error) {
    console.error('Error creating manager evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating manager evaluation',
      error: error.message
    });
  }
}));

// PATCH /api/capability-evaluations/:id - Update manager evaluation
router.patch('/:id', asyncHandler(async (req, res) => {
  try {
    const evaluation = await ManagerEvaluation.findById(req.params.id);
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Manager evaluation not found'
      });
    }

    const allowedUpdates = [
      'actualScore', 'scoreReason', 'isMandatory', 'mandatoryReason',
      'improvementPlan', 'comments', 'evaluationPeriod', 'nextReviewDate',
      'status', 'approvedBy', 'approvedAt', 'evaluationType', 'performanceCategory',
      'overallRating', 'strengths', 'areasForImprovement', 'nextPeriodGoals'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Recalculate gap if score changed
    if (updates.actualScore !== undefined) {
      updates.gap = updates.actualScore - evaluation.requiredScore;
    }

    // Set approval data if status changed to Approved
    if (updates.status === 'Approved') {
      updates.approvedBy = req.body.approvedBy || req.headers['x-user-role'] || 'Manager';
      updates.approvedAt = new Date();
    }

    Object.assign(evaluation, updates);
    await evaluation.save();

    res.status(200).json({
      success: true,
      data: evaluation,
      message: 'Manager evaluation updated successfully'
    });
  } catch (error) {
    console.error('Error updating manager evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating manager evaluation',
      error: error.message
    });
  }
}));

// DELETE /api/capability-evaluations/:id - Delete manager evaluation
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const evaluation = await ManagerEvaluation.findById(req.params.id);
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Manager evaluation not found'
      });
    }

    await ManagerEvaluation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Manager evaluation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting manager evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting manager evaluation',
      error: error.message
    });
  }
}));

// GET /api/capability-evaluations/employee/:employeeId - Get employee's evaluations
router.get('/employee/:employeeId', asyncHandler(async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    const evaluations = await ManagerEvaluation.find({ employeeId })
      .sort({ evaluatedAt: -1 })
      .populate('capabilitySkillId', 'capabilitySkill capabilityArea');
    
    res.status(200).json({
      success: true,
      data: evaluations,
      message: 'Employee manager evaluations retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching employee manager evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee manager evaluations',
      error: error.message
    });
  }
}));

// GET /api/capability-evaluations/stats/department/:department - Get department evaluation statistics
router.get('/stats/department/:department', asyncHandler(async (req, res) => {
  try {
    const { department } = req.params;
    
    const evaluations = await ManagerEvaluation.find({ employeeRole: { $regex: department, $options: 'i' } });
    
    if (evaluations.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalEvaluations: 0,
          averageScore: 0,
          averageGap: 0,
          mandatoryCount: 0,
          approvedCount: 0
        },
        message: 'No evaluations found for this department'
      });
    }

    const averageScore = evaluations.reduce((sum, e) => sum + e.actualScore, 0) / evaluations.length;
    const averageGap = evaluations.reduce((sum, e) => sum + e.gap, 0) / evaluations.length;
    const mandatoryCount = evaluations.filter(e => e.isMandatory).length;
    const approvedCount = evaluations.filter(e => e.status === 'Approved').length;

    res.status(200).json({
      success: true,
      data: {
        totalEvaluations: evaluations.length,
        averageScore: Math.round(averageScore * 100) / 100,
        averageGap: Math.round(averageGap * 100) / 100,
        mandatoryCount,
        approvedCount,
        approvalRate: Math.round((approvedCount / evaluations.length) * 100)
      },
      message: 'Department manager evaluation statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching department manager evaluation statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching department manager evaluation statistics',
      error: error.message
    });
  }
}));

// GET /api/capability-evaluations/stats/summary - Get overall evaluation summary
router.get('/stats/summary', asyncHandler(async (req, res) => {
  try {
    const { evaluationType, period } = req.query;
    let query = {};
    
    if (evaluationType) query.evaluationType = evaluationType;
    if (period) query.evaluationPeriod = period;

    const evaluations = await ManagerEvaluation.find(query);
    
    if (evaluations.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalEvaluations: 0,
          averageScore: 0,
          averageGap: 0,
          mandatoryCount: 0,
          approvedCount: 0,
          performanceDistribution: {}
        },
        message: 'No evaluations found'
      });
    }

    const averageScore = evaluations.reduce((sum, e) => sum + e.actualScore, 0) / evaluations.length;
    const averageGap = evaluations.reduce((sum, e) => sum + e.gap, 0) / evaluations.length;
    const mandatoryCount = evaluations.filter(e => e.isMandatory).length;
    const approvedCount = evaluations.filter(e => e.status === 'Approved').length;

    // Performance distribution
    const performanceDistribution = {};
    evaluations.forEach(e => {
      const category = e.performanceCategory || 'Meets Expectations';
      performanceDistribution[category] = (performanceDistribution[category] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        totalEvaluations: evaluations.length,
        averageScore: Math.round(averageScore * 100) / 100,
        averageGap: Math.round(averageGap * 100) / 100,
        mandatoryCount,
        approvedCount,
        approvalRate: Math.round((approvedCount / evaluations.length) * 100),
        performanceDistribution
      },
      message: 'Manager evaluation summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching manager evaluation summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching manager evaluation summary',
      error: error.message
    });
  }
}));

// POST /api/capability-evaluations/bulk - Bulk create manager evaluations
router.post('/bulk', asyncHandler(async (req, res) => {
  try {
    const { evaluations } = req.body;
    
    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Evaluations array is required'
      });
    }

    const createdEvaluations = [];
    
    for (const evalData of evaluations) {
      const {
        employeeId,
        employeeName,
        employeeRole,
        capabilitySkillId,
        requiredScore,
        actualScore,
        scoreReason,
        isMandatory = false,
        mandatoryReason,
        evaluatedBy,
        evaluationType = 'Quarterly'
      } = evalData;

      // Validate required fields
      if (!employeeId || !employeeName || !capabilitySkillId || !requiredScore || actualScore === undefined) {
        continue; // Skip invalid entries
      }

      // Validate employee exists
      const employee = await Employee.findOne({ employee_id: employeeId });
      if (!employee) {
        continue;
      }

      // Validate capability skill exists
      const capabilitySkill = await CapabilitySkill.findById(capabilitySkillId);
      if (!capabilitySkill) {
        continue;
      }

      const gap = actualScore - requiredScore;

      const evaluation = new ManagerEvaluation({
        employeeId,
        employeeName,
        employeeRole,
        capabilitySkillId,
        capabilitySkill: capabilitySkill.capabilitySkill,
        capabilityArea: capabilitySkill.capabilityArea,
        requiredScore,
        actualScore,
        scoreReason: scoreReason || '',
        isMandatory,
        mandatoryReason: mandatoryReason || '',
        gap,
        evaluatedBy: evaluatedBy || req.headers['x-user-role'] || 'Manager',
        evaluationType,
        status: 'Submitted'
      });

      createdEvaluations.push(evaluation);
    }

    if (createdEvaluations.length > 0) {
      await ManagerEvaluation.insertMany(createdEvaluations);
    }

    res.status(201).json({
      success: true,
      data: {
        created: createdEvaluations.length,
        skipped: evaluations.length - createdEvaluations.length
      },
      message: `Bulk manager evaluation completed. Created ${createdEvaluations.length} evaluations.`
    });
  } catch (error) {
    console.error('Error creating bulk manager evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bulk manager evaluations',
      error: error.message
    });
  }
}));

module.exports = router;
