const mongoose = require('mongoose');

const EmployeeAssessmentSchema = new mongoose.Schema({
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
  score: {
    type: Number,
    required: true,
    min: 0
  },
  maxScore: {
    type: Number,
    required: true,
    min: 0
  },
  attemptNumber: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pass', 'Fail'],
    required: true
  },
  // Optional: Store assessment answers for detailed analysis
  answers: [{
    questionId: String,
    question: String,
    answer: String,
    isCorrect: Boolean
  }],
  // Optional: Time taken for assessment
  timeTaken: {
    type: Number, // in minutes
    default: 0
  }
}, {
  timestamps: true,
  collection: 'employeeAssessments'
});

// Index for efficient queries
EmployeeAssessmentSchema.index({ trainingId: 1, employeeId: 1 });
EmployeeAssessmentSchema.index({ employeeId: 1 });
EmployeeAssessmentSchema.index({ trainingId: 1 });

module.exports = mongoose.model('EmployeeAssessment', EmployeeAssessmentSchema);
