// models/ApplicantRecord.js
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard working copy of a candidate.
// Created automatically when a CandidateApplication is submitted.
// The original application document is never mutated; all HR edits land here.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');

// ── Interview Round ────────────────────────────────────────────────────────────
const interviewRoundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    stage: {
      type: String,
      enum: [
        'HR Screening',
        'Technical Round 1',
        'Technical Round 2',
        'Manager Round',
        'Director Round',
        'Assignment / Task',
        'Culture Fit',
        'Final Round',
        'Other',
      ],
      default: 'HR Screening',
    },
    customStage:    { type: String, default: '' },   // used when stage === 'Other'
    scheduledDate:  { type: Date,   default: null },
    interviewer:    { type: String, default: '' },
    mode: {
      type: String,
      enum: ['Online', 'Offline', 'Phone', 'Not decided'],
      default: 'Not decided',
    },
    feedback:  { type: String, default: '' },
    result: {
      type: String,
      enum: ['Pending', 'Pass', 'Fail', 'No Show', 'Rescheduled'],
      default: 'Pending',
    },
  },
  { _id: true, timestamps: true },
);

// ── Final Decision ─────────────────────────────────────────────────────────────
const finalDecisionSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ['Pending', 'Offer Made', 'Rejected', 'On Hold', 'Candidate Withdrew'],
      default: 'Pending',
    },
    offeredCTC:   { type: String, default: '' },
    joiningDate:  { type: Date,   default: null },
    decisionDate: { type: Date,   default: null },
    notes:        { type: String, default: '' },
  },
  { _id: false },
);

// ── Main Schema ────────────────────────────────────────────────────────────────
const applicantRecordSchema = new mongoose.Schema(
  {
    // ── Reference to the original immutable application ──────────────────────
    applicationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CandidateApplication',
      required: true,
      index: true,
    },

    // ── Editable copy of candidate details ───────────────────────────────────
    full_name:             { type: String, default: '' },
    email:                 { type: String, default: '' },
    phone:                 { type: String, default: '' },
    whatsapp_same:         { type: Boolean, default: false },
    dob:                   { type: String, default: '' },
    country:               { type: String, default: '' },
    state:                 { type: String, default: '' },
    city:                  { type: String, default: '' },
    pin_code:              { type: String, default: '' },
    relocation:            { type: String, default: '' },
    designation:           { type: String, default: '' },
    designation_id:        { type: Number, default: null },
    highest_qualification: { type: String, default: '' },
    experience:            { type: String, enum: ['Yes', 'No'], default: 'No' },
    total_experience:      { type: String, default: '' },
    current_ctc:           { type: String, default: '' },
    notice_period:         { type: String, default: '' },
    expected_monthly_ctc:  { type: String, default: '' },

    hindi_read:    { type: String, default: '' },
    hindi_write:   { type: String, default: '' },
    hindi_speak:   { type: String, default: '' },
    english_read:  { type: String, default: '' },
    english_write: { type: String, default: '' },
    english_speak: { type: String, default: '' },

    facebookLink:    { type: String, default: '' },
    linkedin:        { type: String, default: '' },
    short_video_url: { type: String, default: '' },

    // ── HR workflow fields ────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'],
      default: 'New',
      index: true,
    },

    internalNotes: { type: String, default: '' },

    interviewRounds: [interviewRoundSchema],

    finalDecision: { type: finalDecisionSchema, default: () => ({}) },

    // ── Convenience flags ─────────────────────────────────────────────────────
    isArchived: { type: Boolean, default: false },
  },
  {
    timestamps: true,   // createdAt = when record was seeded; updatedAt = last HR edit
    collection: 'applicantrecords',
  },
);

// ── Index for fast list queries ───────────────────────────────────────────────
applicantRecordSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ApplicantRecord', applicantRecordSchema);