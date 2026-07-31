const mongoose = require('mongoose');

// One answer per requisition screening question, answered against a
// specific application. questionText is snapshotted at submit time — if
// the requisition's question wording changes later, already-submitted
// answers keep their original meaning rather than silently changing
// underneath a past applicant.
const ScreeningAnswerSchema = new mongoose.Schema(
  {
    questionId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    questionText: { type: String, required: true },
    answer:       { type: String, default: '' },
  },
  { _id: false }
);

const candidateApplicationSchema = new mongoose.Schema(
  {
    full_name:             { type: String, required: true, trim: true },
    email:                 { type: String, required: true, trim: true, lowercase: true },
    phone:                 { type: String, required: true },          // dialCode + number
    whatsapp_same:         { type: Boolean, default: false },
    whatsappNumber:        { type: String, default: '' },             // only meaningful when whatsapp_same === false
    dob:                   { type: String, required: true },

    // No longer a candidate-facing field (there was never an input for it
    // in the UI despite being required) — kept for record completeness,
    // defaulted server-side rather than asked for.
    country:               { type: String, default: 'India' },
    state:                 { type: String, required: true },
    city:                  { type: String, required: true },
    pin_code:              { type: String, required: true, match: /^\d{6}$/ },
    relocation:            { type: String, enum: ['Yes', 'No'], required: true },

    job_id:                { type: Number },
    designation:           { type: String, required: true },
    designation_id:        { type: Number },

    // ── Candidate classification — drives every conditional field below ──────
    candidateType: {
      type: String,
      enum: ['Fresher', 'Experienced', 'Intern'],
      required: true,
    },

    // ── Education ─────────────────────────────────────────────────────────────
    highest_qualification:   { type: String, required: true },
    educationSpecialization: { type: String, default: '' },
    collegeUniversity:       { type: String, default: '' },
    graduationYear:          { type: Number, default: null },

    // ── Intern-only ───────────────────────────────────────────────────────────
    courseName:          { type: String, default: '' },
    semesterOrYear:       { type: String, default: '' },
    internshipDuration:   { type: String, default: '' },

    // ── Experience — shown only for candidateType === 'Experienced' ─────────
    total_experience:     { type: Number, default: null },   // years
    relevantExperience:   { type: Number, default: null },   // years
    current_company:      { type: String, default: '' },
    current_designation:  { type: String, default: '' },

    // ── Compensation ──────────────────────────────────────────────────────────
    // Both explicitly annual now — the old expected_monthly_ctc field name
    // contradicted its own "Expected Annual CTC" label.
    current_ctc:          { type: Number, default: null },
    expected_annual_ctc:  { type: Number, required: true },
    notice_period:        { type: Number, default: null },   // days

    // ── Availability ──────────────────────────────────────────────────────────
    expectedJoiningDate: { type: Date, default: null },

    // ── Skills — ideally drawn from the requisition's own required_skills,
    // free-entry fallback when a requisition hasn't defined any ──────────────
    primarySkills:   { type: [String], default: [] },
    secondarySkills: { type: [String], default: [] },

    // Which languages the candidate knows — replaced the old 6-field
    // per-language read/write/speak proficiency breakdown with a single
    // multi-select; simpler for the candidate, and the granular
    // proficiency levels weren't actually used anywhere downstream.
    languagesKnown: { type: [String], default: [] },
    otherLanguage:  { type: String, default: '' },

    linkedin:              { type: String, default: '' },
    githubPortfolio:       { type: String, default: '' },   // shown only for Technical/Design roles
    short_video_url:       { type: String, default: '' },   // shown only for ClientFacing roles

    preferredWorkMode: {
      type: String,
      enum: ['Remote', 'Hybrid', 'On-site', ''],
      default: '',
    },

    // ── Candidate source — system-captured from the applied link's query
    // param wherever possible; manual dropdown is the fallback, not the
    // primary source, since self-reported channel data is unreliable for
    // cost-per-hire / effectiveness analysis on its own ──────────────────────
    candidateSource: {
      type: String,
      enum: ['Referral', 'Naukri', 'LinkedIn', 'Careers Page', 'Walk-in', 'Campus', 'Other', ''],
      default: '',
    },
    sourceDetail: { type: String, default: '' },

    // Path/URL to the uploaded PDF, set by the upload middleware in
    // routes/candidateApplications.js — never populated directly from
    // req.body (that's just the on-disk path multer wrote it to).
    resume:                { type: String, default: '' },

    screeningAnswers: { type: [ScreeningAnswerSchema], default: [] },

    consentGiven:     { type: Boolean, required: true },
    consentTimestamp: { type: Date, default: null },

    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Shortlisted', 'Rejected'],
      default: 'New',
    },

    // AI fit analysis against the matching requisition's JD — populated
    // on demand via POST /api/applicant-records/:id/analyze, not
    // automatically on every save (200+ applications means running this
    // for every single one unprompted would be a real, ongoing API
    // cost — this only runs when someone actually asks for it).
    ai_fit_score:    { type: Number, default: null },   // 1-10
    ai_fit_summary:  { type: String, default: '' },
    ai_analyzed_at:  { type: Date, default: null },
  },
  { timestamps: true }
);

// Same candidate applying to the same job twice is a data-quality problem
// (duplicate ApplicantRecords, double-counted funnel metrics) more than a
// legitimate re-application path — enforced here, not just checked in the
// route, so it holds even against a direct API call.
candidateApplicationSchema.index({ email: 1, job_id: 1 }, { unique: true });

module.exports = mongoose.model('CandidateApplication', candidateApplicationSchema);
