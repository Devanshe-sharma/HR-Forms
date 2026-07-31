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
        'Technical Round 1',
        'Technical Round 2',
        'Assessment (if any)',
        'CEO Round',
        'MD Round',
      ],
      default: 'Technical Round 1',
    },
    // Logistics state of this round — separate from `result` (the interview
    // outcome). A round can be rescheduled/cancelled without that implying
    // anything about how the candidate actually performed.
    schedulingStatus: {
      type: String,
      enum: ['Scheduled', 'Rescheduled', 'Cancelled'],
      default: 'Scheduled',
    },
    cancellationReason: { type: String, default: '' },   // shown/edited only when schedulingStatus === 'Cancelled'
    scheduledDate:  { type: Date,   default: null },
    scheduledTime:  { type: String, default: '' },   // free-text "HH:MM", kept separate from scheduledDate
    interviewer:    { type: String, default: '' },
    mode: {
      type: String,
      enum: ['Virtual', 'Face-to-Face (F2F)', 'Phone Call', 'Not Decided Yet'],
      default: 'Not Decided Yet',
    },
    meetingLink: { type: String, default: '' },   // meeting URL or physical location text
    // Set either manually by HR, or by the candidate clicking the
    // Yes/Maybe/Can't-attend buttons in the schedule/reschedule email
    // (see routes/applicantRecords.js's public /respond endpoint).
    candidateConfirmation: {
      type: String,
      enum: ['Pending', 'Yes', 'Maybe', 'No'],
      default: 'Pending',
    },
    note:      { type: String, default: '' },
    feedback:  { type: String, default: '' },
    result: {
      type: String,
      enum: ['Selected', 'Rejected', 'Pending', 'On Hold'],
      default: 'Pending',
    },
  },
  { _id: true, timestamps: true },
);

// ── Final Decision (Offer & Placement) ──────────────────────────────────────────
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
    whatsappNumber:        { type: String, default: '' },
    dob:                   { type: String, default: '' },
    country:               { type: String, default: '' },
    state:                 { type: String, default: '' },
    city:                  { type: String, default: '' },
    pin_code:              { type: String, default: '' },
    relocation:            { type: String, default: '' },
    // job_id was missing here too, same gap as CandidateApplication —
    // needed so the AI analysis endpoint can look up the matching
    // requisition's JD without an extra round trip through
    // applicationRef every time.
    job_id:                { type: Number, default: null },
    designation:           { type: String, default: '' },
    designation_id:        { type: Number, default: null },

    // candidateType (Fresher/Experienced/Intern) is now the source of
    // truth from the application form. `experience` (Yes/No) stays here
    // unchanged — and is derived from candidateType at seed time in
    // routes/candidateApplications.js — purely so the existing dashboard
    // EXP/FRESH badge and filter in AllApplicants.tsx keep working without
    // the candidate ever being asked the same thing twice.
    candidateType: { type: String, enum: ['Fresher', 'Experienced', 'Intern', ''], default: '' },
    experience:    { type: String, enum: ['Yes', 'No'], default: 'No' },

    highest_qualification:   { type: String, default: '' },
    educationSpecialization: { type: String, default: '' },
    collegeUniversity:       { type: String, default: '' },
    graduationYear:          { type: Number, default: null },
    courseName:              { type: String, default: '' },
    semesterOrYear:          { type: String, default: '' },
    internshipDuration:      { type: String, default: '' },

    total_experience:     { type: String, default: '' },
    relevantExperience:   { type: Number, default: null },
    current_company:      { type: String, default: '' },
    current_designation:  { type: String, default: '' },
    current_ctc:          { type: String, default: '' },
    notice_period:        { type: String, default: '' },
    // Renamed on CandidateApplication to expected_annual_ctc (the label
    // always said "Annual" while the old field name said "monthly") — kept
    // as expected_monthly_ctc here since AllApplicants.tsx/CandidateInformationTab.tsx
    // already read this exact field name throughout the HR dashboard;
    // routes/candidateApplications.js maps the renamed source field into
    // this one at seed time so the dashboard needs no changes.
    expected_monthly_ctc: { type: String, default: '' },
    expectedJoiningDate:  { type: Date, default: null },

    primarySkills:   { type: [String], default: [] },
    secondarySkills: { type: [String], default: [] },

    languagesKnown: { type: [String], default: [] },
    otherLanguage:  { type: String, default: '' },

    linkedin:        { type: String, default: '' },
    githubPortfolio: { type: String, default: '' },
    short_video_url: { type: String, default: '' },
    preferredWorkMode: { type: String, default: '' },

    candidateSource: { type: String, default: '' },
    sourceDetail:    { type: String, default: '' },

    screeningAnswers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    consentGiven:     { type: Boolean, default: false },
    consentTimestamp: { type: Date, default: null },
    // Resume link — now correctly populated by the fixed Drive upload
    // pipeline in routes/candidateApplications.js (the note that used
    // to be here about this never being wired up is no longer accurate
    // as of tonight's resume upload fix).
    resume:          { type: String, default: '' },

    // ── HR workflow fields ────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'],
      default: 'New',
      index: true,
    },

    internalNotes: { type: String, default: '' },

    // ── AI fit analysis against the matching requisition's JD — populated
    // on demand via POST /api/applicant-records/:id/analyze, never
    // automatically. Stored here (not just on the original
    // CandidateApplication) since this is what the dashboard actually
    // reads from directly.
    ai_fit_score:    { type: Number, default: null },   // 1-10
    ai_fit_summary:  { type: String, default: '' },
    ai_analyzed_at:  { type: Date, default: null },

    // ── Stage 1: Screener Round (HR) ──────────────────────────────────────────
    // Kept as its own group of fields, distinct from interviewRounds — this is
    // the initial HR screening decision, not one of the later interview
    // rounds, mirroring how the Recruitment department's own pipeline treats
    // screening as a separate step before interviews.
    screenerName:   { type: String, default: '' },
    screenerStatus: {
      type: String,
      enum: ['', 'Shortlisted', 'Rejected', 'Candidate On Hold', 'Profile On Hold'],
      default: '',
    },
    screenerNotes:  { type: String, default: '' },

    // ── Stage 2: Interview Round(s) ───────────────────────────────────────────
    interviewRounds: [interviewRoundSchema],

    // ── Stage 3: Offer & Placement ────────────────────────────────────────────
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