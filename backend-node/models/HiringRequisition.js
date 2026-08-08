const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Checklist task sub-schema ──────────────────────────────────────────────
// Each of the 10 HR checklist items tracks Plan/Done/Score/Status/Days Left,
// exactly mirroring the sheet's repeated 5-column block per task.
const ChecklistTaskSchema = new Schema(
  {
    task:       { type: String, required: true }, // e.g. "Role n JD Checked", "Thanked All Applicants"
    plan:       { type: Date,   default: null },
    done:       { type: Date,   default: null },
    score:      { type: Number, default: null },
    status:     { type: String, default: '' },    // e.g. "Done", "Overdue", "Not Yet Due"
    daysLeft:   { type: Number, default: null },
  },
  { _id: false }
);

// ─── History entry sub-schema ───────────────────────────────────────────────
// "Hiring History" in the sheet is a free-text log; structured here so future
// entries can be appended programmatically instead of string-concatenated.
const HistoryEntrySchema = new Schema(
  {
    note:      { type: String, required: true },
    changedBy: { type: String, default: '' },
    date:      { type: Date,   default: Date.now },
  },
  { _id: false }
);

// ─── Screening question sub-schema ──────────────────────────────────────────
// Job-specific questions shown only to candidates applying to THIS
// requisition. Answers are stored on the CandidateApplication with the
// question text snapshotted at answer time (see models/Candidateapplication.js)
// so later edits here never rewrite the meaning of an already-submitted answer.
const ScreeningQuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['mcq', 'yesno', 'numeric', 'text', 'experience', 'skill'],
      required: true,
    },
    options:  { type: [String], default: [] },   // used only when type === 'mcq'
    required: { type: Boolean, default: true },
    minValue: { type: Number, default: null },     // used only for numeric / experience
    maxValue: { type: Number, default: null },
    weight:      { type: Number, default: null },  // optional — enables a computed screening score
    idealAnswer: { type: String, default: '' },    // optional — paired with weight for auto-scoring
  },
  { timestamps: false }
);

const HiringRequisitionSchema = new Schema(
  {
    // ── Auto-generated ────────────────────────────────────────────────────────
    serial_no: { type: Number, required: true, unique: true, index: true },
    hr_approved_at: { type: Date, default: null },

    // ── Requester details ────────────────────────────────────────────────────
    requisitioner_name:  { type: String, required: true, trim: true },
    requisitioner_email: { type: String, trim: true, default: '' },
    request_date:        { type: String, default: '' },

    // ── Position to hire ──────────────────────────────────────────────────────
    hiring_dept:       { type: String, required: true, trim: true },
    hiring_dept_email: { type: String, trim: true, default: '' },
    dept_group_email:  { type: String, trim: true, default: '' },
    reporting_manager: { type: String, default: '' },
    budget: { type: Number, default: null },

    designation_status: { type: String, enum: ['existing', 'new'], required: true }, // sheet: "Designation Exists?"
    designation:         { type: String, required: true, trim: true },
    designation_id:      { type: Number, default: null },

    candidate_experience_level: {
      type: String,
      enum: ['Fresher', 'Experienced', null],
      default: null,
    },

    role_link: { type: String, default: '' },
    jd_link:   { type: String, default: '' },

    // ── Candidate application form configuration ─────────────────────────────
    // Drives conditional fields on the public candidate application form —
    // see frontend/src/pages/Recruitment/CandidateApplication.tsx. Nothing
    // here is candidate-entered; it's set once per requisition and read by
    // every applicant's form load.
    required_skills: { type: [String], default: [] },   // seeds the Primary/Secondary Skills multi-select
    role_category: {
      type: String,
      enum: ['General', 'Technical', 'Design', 'ClientFacing'],
      default: 'General',
    },
    remote_eligible: { type: Boolean, default: false },   // shows Preferred Work Mode when true
    base_location:   { type: String, default: '' },       // used to phrase the relocation question for this job

    screeningQuestions: { type: [ScreeningQuestionSchema], default: [] },

    // ── Joining timeline ──────────────────────────────────────────────────────
    select_joining_days:        { type: String, required: true },
    status_date:                 { type: Date,   default: null }, // sheet: "Status Date"
    plan_start_sharing_cvs:     { type: String, default: '' },
    planned_interviews_started: { type: String, default: '' },
    planned_offer_accepted:     { type: String, default: '' },
    planned_joined:              { type: String, default: '' },

    // ── Actuals (sheet-only fields, previously missing from schema) ──────────
    shortlisted_cvs_sharing_started: { type: Date, default: null },
    interviews_started_date:          { type: Date, default: null },
    offer_sent_date:                  { type: Date, default: null },
    offer_accepted_date:              { type: Date, default: null },

    // ── Outcome / closure tracking ───────────────────────────────────────────
    not_accepted_joined_reason: { type: String, default: '' },
    hiring_closed_reason:        { type: String, default: '' },
    hr_remarks:                   { type: String, default: '' },

    // ── History log (replaces flat "Hiring History" text column) ────────────
    hiring_history: { type: [HistoryEntrySchema], default: [] },

    message_id: { type: String, default: '' }, // sheet: "Message Id" — for email thread tracking

    // ── Special instructions & status ────────────────────────────────────────
    special_instructions: { type: String, default: '' },
    hiring_status:         { type: String, required: true, default: 'New' },

    fmsStatus: { type: String, enum: ['Open', 'Closed'], default: 'Open', index: true },
    // Stamped the moment fmsStatus first transitions to 'Closed' (see
    // rescoreAndSave in routes/hiringRequisitions.js), and cleared back to
    // null if it ever reopens — always reflects the current closure
    // episode's close date, not just "was ever closed once". Powers the
    // Average Days to Hire analytics (createdAt -> closed_at).
    closed_at: { type: Date, default: null },
    fms_score: { type: Number, default: 0 }, // sheet: "FMS Score"

    // ── Task progress counters (sheet-computed columns) ──────────────────────
    total_tasks:     { type: Number, default: 0 },
    done_in_time:     { type: Number, default: 0 },
    done_but_delayed: { type: Number, default: 0 },
    tasks_due:        { type: Number, default: 0 },
    tasks_overdue:    { type: Number, default: 0 },
    not_yet_due:      { type: Number, default: 0 },

    // ── CC recipients ────────────────────────────────────────────────────────
    employees_in_cc: { type: [String], default: [] },

    // ── Dept checklist (required Yes/No, raised at requisition time) ────────
    role_n_jd_exist:   { type: String, enum: ['Yes', 'No'], required: true },
    role_n_jd_read:    { type: String, enum: ['Yes', 'No'], required: true },
    role_n_jd_good:    { type: String, enum: ['Yes', 'No'], required: true },
    days_well_thought: { type: String, enum: ['Yes', 'No'], required: true },

    // ── Company SIM questions (raised at requisition time, same style as
    // the dept checklist above — not a scored HR task, just info gathering) ──
    is_sim_needed:                { type: String, enum: ['Yes', 'No', null], default: null },
    sim_needed_reason:            { type: String, default: '' }, // only meaningful when is_sim_needed = 'Yes'
    is_sim_available_for_transfer: { type: String, enum: ['Yes', 'No', null], default: null },

    // ── HR checklist tasks (the 10 repeated Plan/Done/Score/Status/DaysLeft blocks) ──
    checklist_tasks: { type: [ChecklistTaskSchema], default: [] },

    // ── Misc sheet fields with no prior home ─────────────────────────────────
    budget:      { type: Number, default: null },
    assigned_to: { type: String, default: '' },

    // ── Migration tracking ───────────────────────────────────────────────────
    imported_from_sheet: { type: Boolean, default: false },
    sheet_row_number:     { type: Number, default: null },
  },
  { timestamps: true }
);

// ─── Indexes ────────────────────────────────────────────────────────────────────
HiringRequisitionSchema.index({ fmsStatus: 1, createdAt: -1 });
HiringRequisitionSchema.index({ hiring_dept: 1 });
HiringRequisitionSchema.index({ hiring_status: 1 });

module.exports = mongoose.model('HiringRequisition', HiringRequisitionSchema);