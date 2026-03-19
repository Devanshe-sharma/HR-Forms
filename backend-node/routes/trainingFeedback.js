const express = require('express');
const router = express.Router();
const EmployeeFeedback = require('../models/EmployeeFeedback');
const TrainingSchedule = require('../models/TrainingSchedule');
const asyncHandler = require('express-async-handler');

// GET /api/training-feedback - Get all feedback
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { trainingId, employeeId, status, isAnonymous } = req.query;
    let query = {};
    
    if (trainingId) query.trainingId = trainingId;
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (isAnonymous !== undefined) query.isAnonymous = isAnonymous === 'true';

    const feedbacks = await EmployeeFeedback.find(query)
      .sort({ submittedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: feedbacks,
      message: 'Feedback retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedback',
      error: error.message
    });
  }
}));

// GET /api/training-feedback/:id - Get feedback by ID
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const feedback = await EmployeeFeedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: feedback,
      message: 'Feedback retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedback',
      error: error.message
    });
  }
}));

// POST /api/training-feedback - Submit new feedback
router.post('/', asyncHandler(async (req, res) => {
  try {
    const {
      trainingId,
      trainingName,
      employeeName,
      employeeId,
      rating,
      trainerRating,
      contentRating,
      comments,
      improvements,
      wouldRecommend,
      mostValuable,
      suggestions,
      isAnonymous = false
    } = req.body;

    // Validate required fields
    if (!trainingId || !trainingName || !employeeName || !employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: trainingId, trainingName, employeeName, employeeId'
      });
    }

    // Validate rating fields
    if (!rating || rating < 1 || rating > 5 ||
        !trainerRating || trainerRating < 1 || trainerRating > 5 ||
        !contentRating || contentRating < 1 || contentRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'All ratings must be between 1 and 5'
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

    // Check if feedback window is still open (if feedbackWindow is set)
    if (training.feedbackWindow) {
      const trainingDate = new Date(training.trainingDate);
      const feedbackDeadline = new Date(trainingDate.getTime() + training.feedbackWindow * 60 * 60 * 1000);
      
      if (new Date() > feedbackDeadline) {
        return res.status(400).json({
          success: false,
          message: 'Feedback window has closed'
        });
      }
    }

    // Check if employee has already submitted feedback
    const existingFeedback = await EmployeeFeedback.findOne({
      trainingId,
      employeeId
    });

    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this training'
      });
    }

    const feedback = new EmployeeFeedback({
      trainingId,
      trainingName,
      employeeName: isAnonymous ? 'Anonymous' : employeeName,
      employeeId: isAnonymous ? 'anonymous' : employeeId,
      rating,
      trainerRating,
      contentRating,
      comments: comments || '',
      improvements: improvements || '',
      wouldRecommend,
      mostValuable: mostValuable || '',
      suggestions: suggestions || '',
      isAnonymous
    });

    await feedback.save();

    res.status(201).json({
      success: true,
      data: feedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
}));

// PUT /api/training-feedback/:id - Update feedback (admin only)
router.put('/:id', asyncHandler(async (req, res) => {
  try {
    const feedback = await EmployeeFeedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    const allowedUpdates = ['status', 'reviewedBy', 'comments', 'improvements'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.status === 'Reviewed') {
      updates.reviewedBy = req.body.reviewedBy || req.headers['x-user-role'] || 'Admin';
      updates.reviewedAt = new Date();
    }

    Object.assign(feedback, updates);
    await feedback.save();

    res.status(200).json({
      success: true,
      data: feedback,
      message: 'Feedback updated successfully'
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feedback',
      error: error.message
    });
  }
}));

// DELETE /api/training-feedback/:id - Delete feedback (admin only)
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    const feedback = await EmployeeFeedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    await EmployeeFeedback.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting feedback',
      error: error.message
    });
  }
}));

// GET /api/training-feedback/stats/:trainingId - Get feedback statistics for a training
router.get('/stats/:trainingId', asyncHandler(async (req, res) => {
  try {
    const { trainingId } = req.params;
    
    const feedbacks = await EmployeeFeedback.find({ trainingId });
    
    if (feedbacks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalFeedbacks: 0,
          averageRating: 0,
          averageTrainerRating: 0,
          averageContentRating: 0,
          recommendationRate: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        },
        message: 'No feedback found for this training'
      });
    }

    const averageRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
    const averageTrainerRating = feedbacks.reduce((sum, f) => sum + f.trainerRating, 0) / feedbacks.length;
    const averageContentRating = feedbacks.reduce((sum, f) => sum + f.contentRating, 0) / feedbacks.length;
    const recommendationRate = (feedbacks.filter(f => f.wouldRecommend).length / feedbacks.length) * 100;

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbacks.forEach(f => {
      ratingDistribution[f.rating]++;
    });

    res.status(200).json({
      success: true,
      data: {
        totalFeedbacks: feedbacks.length,
        averageRating: Math.round(averageRating * 100) / 100,
        averageTrainerRating: Math.round(averageTrainerRating * 100) / 100,
        averageContentRating: Math.round(averageContentRating * 100) / 100,
        recommendationRate: Math.round(recommendationRate * 100) / 100,
        ratingDistribution
      },
      message: 'Feedback statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching feedback statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedback statistics',
      error: error.message
    });
  }
}));

// GET /api/training-feedback/summary/:trainingId - Get detailed feedback summary
router.get('/summary/:trainingId', asyncHandler(async (req, res) => {
  try {
    const { trainingId } = req.params;
    
    const feedbacks = await EmployeeFeedback.find({ trainingId });
    
    if (feedbacks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalFeedbacks: 0,
          averageRating: 0,
          recommendationRate: 0,
          commonComments: [],
          commonImprovements: []
        },
        message: 'No feedback found for this training'
      });
    }

    const averageRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
    const recommendationRate = (feedbacks.filter(f => f.wouldRecommend).length / feedbacks.length) * 100;

    // Extract common comments and improvements
    const comments = feedbacks
      .filter(f => f.comments && f.comments.trim())
      .map(f => f.comments.trim());
    
    const improvements = feedbacks
      .filter(f => f.improvements && f.improvements.trim())
      .map(f => f.improvements.trim());

    res.status(200).json({
      success: true,
      data: {
        totalFeedbacks: feedbacks.length,
        averageRating: Math.round(averageRating * 100) / 100,
        recommendationRate: Math.round(recommendationRate * 100) / 100,
        commonComments: comments,
        commonImprovements: improvements
      },
      message: 'Feedback summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching feedback summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching feedback summary',
      error: error.message
    });
  }
}));

module.exports = router;
