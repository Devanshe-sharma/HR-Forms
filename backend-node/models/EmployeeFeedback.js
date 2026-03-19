const mongoose = require('mongoose');

const EmployeeFeedbackSchema = new mongoose.Schema({
  trainingId: {
    type: String,
    required: true
  },
  trainingName: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  employeeId: {
    type: String,
    required: true
  },
  // Rating fields (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  trainerRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  contentRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  // Text feedback
  comments: {
    type: String,
    default: ''
  },
  improvements: {
    type: String,
    default: ''
  },
  // Recommendation
  wouldRecommend: {
    type: Boolean,
    required: true
  },
  // Additional feedback fields
  mostValuable: {
    type: String,
    default: ''
  },
  suggestions: {
    type: String,
    default: ''
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  // Feedback status
  status: {
    type: String,
    enum: ['Submitted', 'Reviewed'],
    default: 'Submitted'
  },
  // Admin review
  reviewedBy: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: Date
  },
  // Anonymous feedback option
  isAnonymous: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'employeeFeedbacks'
});

// Index for efficient queries
EmployeeFeedbackSchema.index({ trainingId: 1, employeeId: 1 });
EmployeeFeedbackSchema.index({ employeeId: 1 });
EmployeeFeedbackSchema.index({ trainingId: 1 });
EmployeeFeedbackSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('EmployeeFeedback', EmployeeFeedbackSchema);
