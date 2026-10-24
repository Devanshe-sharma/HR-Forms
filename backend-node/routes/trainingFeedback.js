const express = require('express');
const router = express.Router();
const EmployeeFeedback = require('../models/EmployeeFeedback');
const TrainingSchedule = require('../models/TrainingSchedule');
const mongoose = require('mongoose');
const Onboarding = require('../models/onboardingModel');
const { verifyTrainingFeedback } = require('../utils/trainingFeedbackSigning');
const { authenticate } = require('../middleware/authenticate');
const { feedbackClosesAt } = require('../utils/trainingFeedbackWindow');
const asyncHandler = require('express-async-handler');

const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Who is logged in, as an employee: name + empId from their Onboarding record
// (matched on official email), falling back to the login's own name/email.
// Identity always comes from the JWT — never from the request body.
async function currentEmployee(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const own = email
    ? await Onboarding.findOne({ officialEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') })
        .select('name empId').lean()
    : null;
  return {
    email,
    employeeName: own?.name || user?.name || email,
    employeeId: own?.empId || email,
  };
}

// ─── Public, login-free feedback (the standalone page employees open from the
// mail). The signed link proves the person was sent this training's form;
// the official email they type picks who they are (matched against the
// Onboarding records), so no dashboard login or access is involved. ─────────

const publicTraining = async (id, sig) => {
  if (!mongoose.isValidObjectId(id) || !verifyTrainingFeedback(id, sig)) return null;
  return TrainingSchedule.findById(id);
};

// GET /api/training-feedback/public/:id?sig=…  — what the page shows
router.get('/public/:id', asyncHandler(async (req, res) => {
  const training = await publicTraining(req.params.id, req.query.sig);
  if (!training) return res.status(403).json({ success: false, message: 'This link is invalid.' });
  const closesAt = feedbackClosesAt(training);
  res.json({
    success: true,
    data: {
      trainingName: training.trainingName,
      trainerName: training.trainerName,
      trainingDate: training.trainingDate,
      startTime: training.startTime,
      endTime: training.endTime,
      completed: training.status === 'Completed',
      feedbackClosesAt: closesAt ? closesAt.toISOString() : null,
      open: training.status === 'Completed' && (!closesAt || new Date() <= closesAt),
    },
  });
}));

// POST /api/training-feedback/public/:id  — { sig, email, ratings… }
router.post('/public/:id', asyncHandler(async (req, res) => {
  const fail = (status, msg) => res.status(status).json({ success: false, message: msg });
  const { sig, email, rating, trainerRating, contentRating, wouldRecommend, comments, improvements } = req.body || {};

  const training = await publicTraining(req.params.id, sig);
  if (!training) return fail(403, 'This link is invalid.');
  if (training.status !== 'Completed') return fail(400, 'Feedback is not open for this training yet.');
  const closesAt = feedbackClosesAt(training);
  if (closesAt && new Date() > closesAt) return fail(400, 'The feedback window for this training has closed.');

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return fail(400, 'Please enter your official email.');
  const own = await Onboarding.findOne({ officialEmail: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') }).select('name empId').lean();
  if (!own) return fail(404, "We couldn't find that email. Please use your official Brisk Olive email.");

  const inRange = n => Number.isInteger(n) && n >= 1 && n <= 5;
  if (![rating, trainerRating, contentRating].every(inRange)) return fail(400, 'Please give all three star ratings (1–5).');
  if (typeof wouldRecommend !== 'boolean') return fail(400, 'Please answer whether you would recommend this training.');

  const already = await EmployeeFeedback.findOne({ trainingId: training.trainingId, submittedByEmail: cleanEmail });
  if (already) return fail(400, 'You have already submitted feedback for this training.');

  await EmployeeFeedback.create({
    trainingId: training.trainingId,
    trainingName: training.trainingName,
    submittedByEmail: cleanEmail,
    employeeName: own.name || cleanEmail,
    employeeId: own.empId || cleanEmail,
    rating, trainerRating, contentRating, wouldRecommend,
    comments: String(comments || '').trim(),
    improvements: String(improvements || '').trim(),
  });
  res.status(201).json({ success: true, message: 'Thank you — your feedback has been recorded.' });
}));

// GET /api/training-feedback/mine - trainingIds the logged-in person has
// already given feedback for (so the page can show "submitted" correctly
// instead of treating anyone's feedback as theirs).
router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  const me = await currentEmployee(req.user);
  const mine = await EmployeeFeedback.find({ submittedByEmail: me.email }).select('trainingId rating').lean();
  res.json({ success: true, data: mine });
}));

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
router.post('/', authenticate, asyncHandler(async (req, res) => {
  try {
    const {
      trainingId,
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

    // Every failure sends both `message` and `error` — the page reads `error`.
    const fail = (status, msg) => res.status(status).json({ success: false, message: msg, error: msg });

    if (!trainingId) return fail(400, 'trainingId is required');

    // Validate rating fields
    if (!rating || rating < 1 || rating > 5 ||
        !trainerRating || trainerRating < 1 || trainerRating > 5 ||
        !contentRating || contentRating < 1 || contentRating > 5) {
      return fail(400, 'All ratings must be between 1 and 5');
    }
    if (typeof wouldRecommend !== 'boolean') return fail(400, 'Please answer whether you would recommend this training');

    // Check if training exists and is completed
    const training = await TrainingSchedule.findOne({ trainingId, status: 'Completed' });
    if (!training) return fail(400, 'Training not found or not completed');

    // Feedback is open for `feedbackWindow` hours after the training ENDS.
    const closesAt = feedbackClosesAt(training);
    if (closesAt && new Date() > closesAt) return fail(400, 'Feedback window has closed');

    const me = await currentEmployee(req.user);

    // One submission per person per training (works for anonymous ones too).
    const existingFeedback = await EmployeeFeedback.findOne({ trainingId, submittedByEmail: me.email });
    if (existingFeedback) return fail(400, 'Feedback already submitted for this training');

    const feedback = new EmployeeFeedback({
      trainingId,
      trainingName: training.trainingName,
      submittedByEmail: me.email,
      employeeName: isAnonymous ? 'Anonymous' : me.employeeName,
      employeeId: isAnonymous ? 'anonymous' : me.employeeId,
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
