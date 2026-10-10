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
    // Which stage of the fixed HR -> Technical -> Management pipeline this
    // round belongs to — the pipeline order and gating (utils/roundPipeline.js
    // hasPassedRound) are keyed off this, not off the free-text `stage` label
    // below (which only exists for display/back-compat with pre-migration data).
    roundType: { type: String, enum: ['hr', 'tech', 'mgmt'], required: true },
    // Per-roundType instance counter — "HR Round", "HR Round 2", etc.
    roundNumber: { type: Number, required: true },
    // Free-text display label, derived from roundType+roundNumber when a
    // round is created (see ROUND_TYPE_LABELS in routes/applicantRecords.js)
    // — kept only so old UI/reports that read `.stage` still show something
    // sensible; never used for pipeline logic.
    stage: { type: String, default: '' },
    // Logistics state of this round — a round can be rescheduled/cancelled
    // without that implying anything about how the candidate performed;
    // the actual outcome now lives one level up as interviewFinalStatus.
    schedulingStatus: {
      type: String,
      enum: ['', 'Scheduled', 'Rescheduled', 'Done', 'Cancelled'],
      default: '',
    },
    cancellationReason: { type: String, default: '' },   // shown/edited only when schedulingStatus === 'Cancelled'
    scheduledDate:  { type: Date,   default: null },
    scheduledTime:  { type: String, default: '' },   // free-text "HH:MM", kept separate from scheduledDate
    interviewer:    { type: String, default: '' },
    mode: {
      type: String,
      enum: ['', 'Virtual', 'Face-to-Face (F2F)', 'Phone Call', 'Not Decided Yet'],
      default: '',
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
    // The interviewer's own recommendation for this round — feeds into what
    // interviewFinalStatus (on the parent ApplicantRecord) is allowed to be
    // set to, and into hasPassedRound's pipeline gating. One shared field
    // serves all three round types; the frontend only offers the subset
    // relevant to the round's roundType ('Select'/'Select with Conditions'/
    // 'Hold'/'Reject' are Management-only, the rest are HR/Technical).
    interviewerFeedbackStatus: {
      type: String,
      enum: [
        '', 'Recommended as P1', 'Recommended as P2', 'Not Recommended', 'Candidate on Hold',
        'Select', 'Select with Conditions', 'Hold', 'Reject',
      ],
      default: '',
    },
    // HR Round only — the candidate-background subform from the mockup's
    // HR evaluation, prefilled client-side from the candidate's existing
    // profile the first time the round is opened, then independently
    // editable (HR may learn things in the interview that update it).
    hrBackground: {
      nativePlace:         { type: String, default: '' },
      residingIn:          { type: String, default: '' },
      commuteType:         { type: String, default: '' },
      age:                 { type: String, default: '' },
      family:              { type: String, default: '' },
      education:           { type: String, default: '' },
      hobbies:             { type: String, default: '' },
      experienceSummary:   { type: String, default: '' },
      currentCtc:          { type: String, default: '' },
      pfApplicable:        { type: String, default: '' },
      expectedCtc:         { type: String, default: '' },
      recommendedCtc:      { type: String, default: '' },
      currentCompany:      { type: String, default: '' },
      noticePeriodSummary: { type: String, default: '' },
      whenCanJoin:         { type: String, default: '' },
      reasonForLeaving:    { type: String, default: '' },
      skillsSummary:       { type: String, default: '' },
    },
    // HR Round only.
    bond: {
      type: String,
      enum: ['', 'Not discussed', 'Willing to sign bond', 'Negotiable', 'Not willing'],
      default: '',
    },
  },
  { _id: true, timestamps: true },
);

// ── Offer letter — either an HTML preview rendered from a template, or a
// real signed file HR uploaded (same Drive pattern as uploadedDocumentSchema
// below). Not mutually exclusive — HR can generate a preview first, then
// upload the actually-signed version once it comes back.
const offerLetterSchema = new mongoose.Schema(
  {
    source:        { type: String, enum: ['', 'generated', 'uploaded'], default: '' },
    generatedHtml: { type: String, default: '' },
    fileName:      { type: String, default: '' },
    driveLink:     { type: String, default: '' },
    updatedAt:     { type: Date, default: null },
  },
  { _id: false },
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
    offerLetter:  { type: offerLetterSchema, default: () => ({}) },
  },
  { _id: false },
);

// ── Joining Management — tracked separately from finalDecision.joiningDate
// (the originally PLANNED date candidates agree to at offer time); this is
// the actual post-acceptance tracking HR does up to the person's first day.
const joiningSchema = new mongoose.Schema(
  {
    confirmedDate: { type: Date, default: null },
    actualDate:    { type: Date, default: null },
    status: {
      type: String,
      enum: ['', 'Joining Pending', 'Joined', 'Did Not Join', 'Offer Withdrawn'],
      default: '',
    },
    docsStatus: {
      type: String,
      enum: ['Pending', 'Partially Received', 'Complete'],
      default: 'Pending',
    },
    bgvStatus: {
      type: String,
      enum: ['Not Applicable', 'Pending', 'In Progress', 'Cleared', 'Adverse'],
      default: 'Not Applicable',
    },
    remarks: { type: String, default: '' },
  },
  { _id: false },
);

// ── Chronological event log — one entry per meaningful transition (screener
// decision, round scheduled/completed/feedback, stage change, offer/joining
// events). Append-only; see utils/candidateEvents.js. Powers the Timeline &
// History tab without having to reverse-engineer timestamps scattered across
// other fields.
const candidateEventSchema = new mongoose.Schema(
  {
    key:    { type: String, required: true },   // stable id so a later event can update rather than duplicate (e.g. "stg-Shortlisted")
    label:  { type: String, default: '' },
    when:   { type: Date, default: Date.now },
    detail: { type: String, default: '' },
  },
  { _id: false },
);

// ── Excel Test — HR-graded, not auto-scored (free-text formula answers
// can't be reliably auto-graded). Candidate submits answers; HR marks each
// one correct/incorrect afterward; score is derived from those marks.
const excelTestSchema = new mongoose.Schema(
  {
    sentAt: { type: Date, default: null },
    status: { type: String, enum: ['', 'Sent', 'Submitted', 'Graded'], default: '' },
    answers: { type: [{ question: String, answer: String }], default: [] },
    marks:  { type: [Boolean], default: [] },   // same length/order as answers, filled in once HR grades
    score:  { type: Number, default: null },    // % correct, computed from marks once graded
  },
  { _id: false },
);

// ── DISC Assessment — real forced-choice questionnaire (utils/assessmentBank.js),
// genuinely scored from the candidate's own answers, not fabricated.
const discAssessmentSchema = new mongoose.Schema(
  {
    sentAt: { type: Date, default: null },
    status: { type: String, enum: ['', 'Sent', 'Completed'], default: '' },
    scores: {
      D: { type: Number, default: 0 },
      I: { type: Number, default: 0 },
      S: { type: Number, default: 0 },
      C: { type: Number, default: 0 },
    },
    primary: { type: String, enum: ['', 'D', 'I', 'S', 'C'], default: '' },
  },
  { _id: false },
);

// ── Additional applications by the same person over time — the original
// applicationRef stays the FIRST application; later ones (for a different
// role, found as a "possible duplicate" at submission time) get linked here
// via POST /:id/link-application instead of creating a second profile.
const linkedApplicationSchema = new mongoose.Schema(
  {
    position:       { type: String, default: '' },
    date:           { type: Date, default: null },
    source:         { type: String, default: '' },
    applicationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateApplication', default: null },
  },
  { _id: false },
);

// ── Document uploaded by the candidate via the post-offer upload link ───────
// docType is one of REQUIRED_DOCUMENT_TYPES' keys (see routes/applicantRecords.js)
// — kept as free text rather than an enum so an old upload stays valid even if
// the required-document list itself changes later.
const uploadedDocumentSchema = new mongoose.Schema(
  {
    docType:    { type: String, default: '' },
    fileName:   { type: String, default: '' },
    driveLink:  { type: String, default: '' },
    uploadedAt: { type: Date,   default: null },
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

    // Set once the candidate rejection mail (screening or interview stage)
    // is actually sent — a single send-once gate shared by both stages,
    // rather than a separate flag per stage, since it's the same email.
    rejectionMailSentAt: { type: Date, default: null },

    // ── AI fit analysis against the matching requisition's JD — populated
    // on demand via POST /api/applicant-records/:id/analyze, never
    // automatically. Stored here (not just on the original
    // CandidateApplication) since this is what the dashboard actually
    // reads from directly.
    ai_fit_score:    { type: Number, default: null },   // 1-10
    ai_fit_summary:  { type: String, default: '' },
    ai_analyzed_at:  { type: Date, default: null },

    // ── Deterministic ATS match score (0-100%) — a DIFFERENT, automatic
    // concept from ai_fit_score above: skills/experience/location/notice-
    // period match against the requisition, recomputed on every create/edit
    // via utils/atsMatchScore.js. Not AI-based, no API cost, always current.
    atsMatchScore: { type: Number, default: null },

    // ── Assessments ────────────────────────────────────────────────────────
    excelTest:       { type: excelTestSchema, default: () => ({}) },
    discAssessment:  { type: discAssessmentSchema, default: () => ({}) },

    // ── Other applications by this same person, linked rather than
    // duplicated — see POST /:id/link-application.
    applications: { type: [linkedApplicationSchema], default: [] },

    // ── Timeline & History ────────────────────────────────────────────────
    events: { type: [candidateEventSchema], default: [] },

    // ── LEGACY — Screener Round (HR) ──────────────────────────────────────────
    // Superseded by the 'hr' roundType in interviewRounds (see
    // utils/roundPipeline.js), which folds the HR decision into the fixed
    // HR -> Technical -> Management pipeline instead of a separate
    // pre-interview step. Left in place, read-only going forward, so old
    // records and scripts/migrateToFixedRoundPipeline.js can still read the
    // historical decision; nothing should write to these three fields anymore.
    screenerName:   { type: String, default: '' },
    screenerStatus: {
      type: String,
      enum: ['', 'Shortlisted', 'Rejected', 'Candidate On Hold', 'Profile On Hold'],
      default: '',
    },
    screenerNotes:  { type: String, default: '' },

    // ── Stage 2: Interview Round(s) ───────────────────────────────────────────
    interviewRounds: [interviewRoundSchema],
    // Overall outcome of the interview stage — distinct from any single
    // round's own scheduling/feedback state. HR sets this directly; it's
    // constrained (see routes/applicantRecords.js) by what interviewers
    // have recommended on individual rounds, so a Recommended-P1/P2
    // candidate can't be silently marked Rejected, and a Not-Recommended
    // one can't be silently marked Shortlisted.
    // Starts at 'New' — only advances to 'In Progress' once at least one
    // interview round is actually marked Done (see maybeAdvanceInterviewStatus
    // in routes/applicantRecords.js). Before that, a candidate who's merely
    // had a round scheduled still reads as 'New', not 'In Progress'.
    interviewFinalStatus: {
      type: String,
      enum: ['New', 'In Progress', 'Shortlisted', 'Rejected'],
      default: 'New',
    },

    // ── Stage 3: Offer & Placement ────────────────────────────────────────────
    finalDecision: { type: finalDecisionSchema, default: () => ({}) },
    // Post-acceptance joining tracking — separate from finalDecision's own
    // planned joiningDate (see joiningSchema comment above).
    joining: { type: joiningSchema, default: () => ({}) },

    // Offer Letter email — sent manually from OfferPlacementTab once
    // finalDecision is "Offer Made". Creates documentsUploadFolder* the
    // first time it's sent (idempotent on resend), then links the
    // candidate to the public /candidate-upload/:id page.
    offerLetterSentAt:         { type: Date,   default: null },
    documentsUploadFolderId:   { type: String, default: '' },
    documentsUploadFolderLink: { type: String, default: '' },
    uploadedDocuments:         { type: [uploadedDocumentSchema], default: [] },

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