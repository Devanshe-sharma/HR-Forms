const mongoose = require('mongoose');

const pmsScoreSchema = new mongoose.Schema({
  period: { type: String, default: '' },
  score:  { type: Number, default: 0  },
}, { _id: false });

const managerDecisionSchema = new mongoose.Schema({
  decision         : { type: String, enum: ['increment', 'pip', null], default: null },
  recommendedPct   : { type: Number, default: null },
  pipDurationMonths: { type: Number, default: null },
  pipNewDueDate    : { type: Date,   default: null },
  reason           : { type: String, default: '' },
  submittedAt      : { type: Date,   default: null },
}, { _id: false });

const managementDecisionSchema = new mongoose.Schema({
  finalPct    : { type: Number,  default: null },
  pipApproved : { type: Boolean, default: null },
  reason      : { type: String,  default: '' },
  submittedAt : { type: Date,    default: null },
}, { _id: false });

const hrDecisionSchema = new mongoose.Schema({
  newCtc        : { type: Number, default: null },
  applicableDate: { type: Date,   default: null },
  notes         : { type: String, default: '' },
  submittedAt   : { type: Date,   default: null },
}, { _id: false });

const salaryRevisionSchema = new mongoose.Schema({

  // Link straight back to the Onboarding record this revision is for —
  // Onboarding is the single source of truth for employee data now.
  // employeeCode is kept as the Onboarding _id (string) for backward
  // compatibility with existing lookups/filters.
  onboardingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', default: null },

  // Employee info (snapshotted at creation time, in case Onboarding changes later)
  employeeCode : { type: String, required: [true, 'employeeCode is required'], trim: true },
  employeeName : { type: String, required: [true, 'employeeName is required'], trim: true },
  department   : { type: String, required: [true, 'department is required'],   trim: true },
  designation  : { type: String, required: [true, 'designation is required'],  trim: true },
  email        : { type: String, required: [true, 'email is required'], trim: true, lowercase: true },
  joiningDate  : { type: Date,   required: [true, 'joiningDate is required'] },

  category: {
    type   : String,
    enum   : ['Employee', 'Consultant', 'Intern', 'Temporary Staff', 'Contract Based'],
    default: 'Employee',
  },

  // ── Designation change — independent of salary/increment decision ──────
  // Not every revision changes designation. Sometimes only salary changes,
  // sometimes only designation changes, sometimes both.
  designationChanged  : { type: Boolean, default: false },
  previousDesignation : { type: String,  default: '' },
  newDesignation       : { type: String,  default: null },

  // ── Reporting head change — also independent ────────────────────────────
  reportingHeadChanged  : { type: Boolean, default: false },
  previousReportingHead : { type: String,  default: '' },
  newReportingHead       : { type: String,  default: null },

  // Salary
  previousCtc      : { type: Number, required: [true, 'previousCtc is required'], min: 0 },
  newCtc           : { type: Number, default: null },
  finalIncrementPct: { type: Number, default: null },
  applicableDate   : { type: Date,   default: null },

  // PMS Scores
  pmsScores: { type: [pmsScoreSchema], default: [] },

  // Workflow stage
  stage: {
    type   : String,
    enum   : ['pending_manager', 'pending_management', 'pending_hr', 'completed', 'on_hold'],
    default: 'pending_manager',
  },

  // Decision sub-documents
  managerDecision   : { type: managerDecisionSchema,    default: () => ({}) },
  managementDecision: { type: managementDecisionSchema, default: () => ({}) },
  hrDecision        : { type: hrDecisionSchema,         default: () => ({}) },

  // PIP re-evaluation date
  reviewDate: { type: Date, default: null },

  // Audit — support BOTH old (created_by) and new (createdBy) names
  created_by: { type: String, default: 'System' },
  createdBy  : { type: String, default: 'System' },
  updated_by : { type: String, default: 'System' },
  updatedBy  : { type: String, default: 'System' },

}, { timestamps: true });

salaryRevisionSchema.index({ employeeCode: 1, createdAt: -1 });
salaryRevisionSchema.index({ stage: 1 });

module.exports = mongoose.model('SalaryRevision', salaryRevisionSchema);