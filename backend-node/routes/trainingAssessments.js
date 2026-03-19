const express = require('express');
const router = express.Router();
const EmployeeAssessment = require('../models/EmployeeAssessment');
const TrainingSchedule = require('../models/TrainingSchedule');
const asyncHandler = require('express-async-handler');

// GET /api/training-assessments - Get all assessments
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { trainingId, employeeId, status } = req.query;
    let query = {};
    
    if (trainingId) query.trainingId = trainingId;
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const assessments = await EmployeeAssessment.find(query)
      .sort({ submittedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: assessments,
      message: 'Assessments retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assessments',
      error: error.message
    });
  }
}));

// GET /api/training-assessments/:id - Get assessment by ID
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const assessment = await EmployeeAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: assessment,
      message: 'Assessment retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment',
      error: error.message
    });
  }
}));

// POST /api/training-assessments - Submit new assessment
router.post('/', asyncHandler(async (req, res) => {
  try {
    const {
      trainingId,
      trainingName,
      employeeName,
      employeeId,
      score,
      maxScore,
      attemptNumber = 1,
      answers = [],
      timeTaken = 0
    } = req.body;

    // Validate required fields
    if (!trainingId || !trainingName || !employeeName || !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: trainingId, trainingName, employeeName, employeeId'
      });
    }

    // Check if training exists and is completed
    const training = await TrainingSchedule.findOne({ 
      trainingId, 
      status: 'Completed' 
    });
    
    if (!training) {
      return res.status(400).json({
        success: false,
        message: 'Training not found or not completed'
      });
    }

    // Calculate pass/fail status (assuming 60% is passing)
    const percentage = (score / maxScore) * 100;
    const status = percentage >= 60 ? 'Pass' : 'Fail';

    // Check if employee has already attempted this assessment
    const existingAssessment = await EmployeeAssessment.findOne({
      trainingId,
      employeeId
    });

    if (existingAssessment) {
      return res.status(400).json({
        success: false,
        message: 'Assessment already submitted for this training'
      });
    }

    const assessment = new EmployeeAssessment({
      trainingId,
      trainingName,
      employeeName,
      employeeId,
      score,
      maxScore,
      attemptNumber,
      status,
      answers,
      timeTaken
    });

    await assessment.save();

    res.status(201).json({
      success: true,
      data: assessment,
      message: 'Assessment submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting assessment',
      error: error.message
    });
  }
}));

// PUT /api/training-assessments/:id - Update assessment
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const assessment = await EmployeeAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const allowedUpdates = ['score', 'maxScore', 'status', 'answers', 'timeTaken'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Recalculate status if score or maxScore changed
    if (updates.score !== undefined || updates.maxScore !== undefined) {
      const score = updates.score !== undefined ? updates.score : assessment.score;
      const maxScore = updates.maxScore !== undefined ? updates.maxScore : assessment.maxScore;
      const percentage = (score / maxScore) * 100;
      updates.status = percentage >= 60 ? 'Pass' : 'Fail';
    }

    Object.assign(assessment, updates);
    await assessment.save();

    res.status(200).json({
      success: true,
      data: assessment,
      message: 'Assessment updated successfully'
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating assessment',
      error: error.message
    });
  }
}));

// DELETE /api/training-assessments/:id - Delete assessment
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const assessment = await EmployeeAssessment.findById(req.params.id);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    await EmployeeAssessment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting assessment',
      error: error.message
    });
  }
}));

// GET /api/training-assessments/stats/:trainingId - Get assessment statistics for a training
router.get('/stats/:trainingId', asyncHandler(async (req, res) => {
  try {
    const { trainingId } = req.params;
    
    const assessments = await EmployeeAssessment.find({ trainingId });
    
    if (assessments.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalAssessments: 0,
          passCount: 0,
          failCount: 0,
          passRate: 0,
          averageScore: 0,
          averageTime: 0
        },
        message: 'No assessments found for this training'
      });
    }

    const passCount = assessments.filter(a => a.status === 'Pass').length;
    const failCount = assessments.filter(a => a.status === 'Fail').length;
    const passRate = (passCount / assessments.length) * 100;
    const averageScore = assessments.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / assessments.length;
    const averageTime = assessments.reduce((sum, a) => sum + a.timeTaken, 0) / assessments.length;

    res.status(200).json({
      success: true,
      data: {
        totalAssessments: assessments.length,
        passCount,
        failCount,
        passRate: Math.round(passRate * 100) / 100,
        averageScore: Math.round(averageScore * 100) / 100,
        averageTime: Math.round(averageTime * 100) / 100
      },
      message: 'Assessment statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching assessment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assessment statistics',
      error: error.message
    });
  }
}));

module.exports = router;
