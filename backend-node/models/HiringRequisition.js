const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Sub-schema: people kept in CC ─────────────────────────────────────────────
// (stored as plain array of email strings — matches employees_in_cc from the form)

const HiringRequisitionSchema = new Schema(
  {
    // ── Auto-generated ────────────────────────────────────────────────────────
    serial_no: { type: Number, required: true, unique: true, index: true },

    // ── Requester details ────────────────────────────────────────────────────
    requisitioner_name:  { type: String, required: true, trim: true },
    requisitioner_email: { type: String, trim: true, default: '' },
    request_date:        { type: String, default: '' }, // stored as 'YYYY-MM-DD' string per form's convertDate()

    // ── Position to hire ──────────────────────────────────────────────────────
    hiring_dept:       { type: String, required: true, trim: true },
    hiring_dept_email: { type: String, trim: true, default: '' },
    dept_group_email:  { type: String, trim: true, default: '' },

    designation_status: { type: String, enum: ['existing', 'new'], required: true },
    designation:         { type: String, required: true, trim: true }, // resolved name (existing or new)
    designation_id:      { type: Number, default: null }, // desig_id when existing

    candidate_experience_level: {
      type: String,
      enum: ['Fresher', 'Experienced', null],
      default: null,
    },

    role_link: { type: String, default: '' },
    jd_link:   { type: String, default: '' },

    // ── Joining timeline ──────────────────────────────────────────────────────
    select_joining_days:        { type: String, required: true },
    plan_start_sharing_cvs:     { type: String, default: '' },
    planned_interviews_started: { type: String, default: '' },
    planned_offer_accepted:     { type: String, default: '' },
    planned_joined:              { type: String, default: '' },

    // ── Special instructions & status ────────────────────────────────────────
    special_instructions: { type: String, default: '' },
    hiring_status:         { type: String, required: true, default: 'New' },

    // ── fmsStatus drives whether this shows on the public job-postings page ──
    // 'Open'   → still actively hiring, visible to candidates
    // 'Closed' → filled / cancelled / on hold, hidden from candidates
    fmsStatus: { type: String, enum: ['Open', 'Closed'], default: 'Open', index: true },

    // ── CC recipients ────────────────────────────────────────────────────────
    employees_in_cc: { type: [String], default: [] },

    // ── Dept checklist (required Yes/No fields) ─────────────────────────────
    role_n_jd_exist:   { type: String, enum: ['Yes', 'No'], required: true },
    role_n_jd_read:    { type: String, enum: ['Yes', 'No'], required: true },
    role_n_jd_good:    { type: String, enum: ['Yes', 'No'], required: true },
    days_well_thought: { type: String, enum: ['Yes', 'No'], required: true },
  },
  { timestamps: true }
);

// ─── Indexes ────────────────────────────────────────────────────────────────────
HiringRequisitionSchema.index({ fmsStatus: 1, createdAt: -1 }); // for job-postings page query
HiringRequisitionSchema.index({ hiring_dept: 1 });

module.exports = mongoose.model('HiringRequisition', HiringRequisitionSchema);