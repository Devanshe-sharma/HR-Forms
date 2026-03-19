const mongoose = require('mongoose');

const ManagerEvaluationSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  employeeRole: {
    type: String,
    required: true
  },
  capabilitySkillId: {
    type: String,
    required: true,
    ref: 'CapabilitySkill'
  },
  capabilitySkill: {
    type: String,
    required: true
  },
  capabilityArea: {
    type: String,
    required: true
  },
  requiredScore: {
    type: Number,
    required: true
  },
  actualScore: {
    type: Number,
    required: true
  },
  scoreReason: {
    type: String,
    default: ''
  },
  isMandatory: {
    type: Boolean,
    default: false
  },
  mandatoryReason: {
    type: String,
    default: ''
  },
  gap: {
    type: Number,
    required: true
  },
  evaluatedBy: {
    type: String,
    required: true
  },
  evaluatedAt: {
    type: Date,
    default: Date.now
  },
  // Additional fields for tracking
  evaluationPeriod: {
    type: String,
    default: ''
  },
  nextReviewDate: {
    type: Date
  },
  improvementPlan: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Submitted'
  },
  // Approval workflow
  approvedBy: {
    type: String,
    default: ''
  },
  approvedAt: {
    type: Date
  },
  comments: {
    type: String,
    default: ''
  },
  // Evaluation type
  evaluationType: {
    type: String,
    enum: ['Quarterly', 'Half-Yearly', 'Annual', 'Probation', 'Special'],
    default: 'Quarterly'
  },
  // Performance category
  performanceCategory: {
    type: String,
    enum: ['Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Unsatisfactory'],
    default: 'Meets Expectations'
  },
  // Overall rating
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  // Strengths and areas for improvement
  strengths: [{
    area: String,
    description: String
  }],
  areasForImprovement: [{
    area: String,
    description: String,
    actionPlan: String
  }],
  // Goals for next period
  nextPeriodGoals: [{
    goal: String,
    target: String,
    deadline: Date
  }]
}, {
  timestamps: true,
  collection: 'capabilityEvaluations'
});

// Index for efficient queries
ManagerEvaluationSchema.index({ employeeId: 1 });
ManagerEvaluationSchema.index({ capabilitySkillId: 1 });
ManagerEvaluationSchema.index({ evaluatedBy: 1 });
ManagerEvaluationSchema.index({ evaluatedAt: -1 });
ManagerEvaluationSchema.index({ status: 1 });
ManagerEvaluationSchema.index({ evaluationType: 1 });

module.exports = mongoose.model('ManagerEvaluation', ManagerEvaluationSchema);
