// models/Training.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingSchema = new Schema({
  // Short display ID e.g. TRN-000001 (set in pre-save)
  trainingId: { type: String, trim: true, default: '' },

  // ── Phase 1: assign capabilities & suggest topic(s) ────────────────────────
  phase1: {
    departments: { type: [String], default: [] }, // empty for Generic
    designation: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    trainingType: {
      type: String,
      enum: ['Generic', 'Dept Specific', 'Level Specific', 'Multi Dept'],
      default: 'Dept Specific',
    },
    level: { type: Number, enum: [1, 2, 3], default: null }, // for Level Specific
    capabilities: { type: [String], default: [] },
    topicSuggestions: { type: [String], default: [] },
    selectedTopic: { type: String, trim: true, default: '' }, // what HR submits for approval
  },

  // ── Phase 2: training details (linked by training_id) ─────────────────────
  phase2: {
    trainingTopic: { type: String, trim: true, default: '' }, // dropdown selection
    type: {
      type: String,
      enum: ['Generic', 'Dept Specific', 'Level Specific', 'Multi Dept'],
      default: 'Dept Specific',
    },
    capabilitiesCovered: { type: [String], default: [] },
    description: { type: String, trim: true, default: '' },
    priority: { type: String, enum: ['P1', 'P2', 'P3'], default: 'P3' },
    trainerType: { type: String, enum: ['Internal Trainer', 'External Consultant'], default: 'Internal Trainer' },
    internalTrainer: {
      employeeId: { type: String, default: '' },
      name: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
    },
    externalTrainer: {
      source: { type: String, default: '' },
      trainerName: { type: String, default: '' },
      organisation: { type: String, default: '' },
      mobile: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    status: { type: String, trim: true, default: 'Draft' },
    contentPdfLink: { type: String, trim: true, default: '' },
    videoLink: { type: String, trim: true, default: '' },
    assessmentLink: { type: String, trim: true, default: '' },
  },

  // Scheduling — set by management after approval (Generic trainings only)
  scheduledDate: { type: Date, default: null },

  approval: {
    status:     { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: String, default: '' },
    remarks:    { type: String, default: '' },
    approvedAt: { type: Date, default: null },
  },

  feedback: [{
    participant: { type: String },
    rating:      { type: Number, min: 1, max: 5 },
    comments:    { type: String, default: '' },
  }],

  scoring: {
    averageScore:    { type: Number, default: 0 },
    finalEvaluation: { type: String, default: '' },
  },

  workflowStatus: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Approved', 'Scheduled', 'Rejected', 'Completed', 'Closed'],
    default: 'Draft',
  },
}, { timestamps: true });

trainingSchema.index({ workflowStatus: 1 });
trainingSchema.index({ 'phase1.designation': 1 });
trainingSchema.index({ 'phase1.trainingType': 1 });
trainingSchema.index({ 'approval.status': 1 });

// Auto-generate a short trainingId on first save
trainingSchema.pre('save', async function () {
  if (!this.trainingId) {
    const count = await mongoose.model('Training').countDocuments();
    this.trainingId = `TRN-${String(count + 1).padStart(6, '0')}`;
  }
});

const Training = mongoose.models.Training || mongoose.model('Training', trainingSchema);
module.exports = Training;