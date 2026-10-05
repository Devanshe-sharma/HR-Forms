const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DecisionSchema = new Schema(
  {
    by: { type: String, trim: true, default: '' },
    at: { type: Date, default: null },
    comment: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// One entry per status change — powers the "chatter" timeline on the
// request detail view (Phase 2). Written on every transition, not just
// approve/refuse, so draft->to_approve and cancel show up too.
const AuditEntrySchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    by: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
    fromStatus: { type: String, trim: true, default: '' },
    toStatus: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// One per mail type (Phase 4) — populated only once that mail is actually
// sent (sentAt stays null until then). No separate drafts collection: the
// HTML is built on demand from live request data and never persisted until
// send, so this is the entire mail history for a request.
const MailRecordSchema = new Schema(
  {
    sentAt: { type: Date, default: null },
    sentBy: { type: String, trim: true, default: '' },
    to: { type: String, trim: true, default: '' },
    cc: { type: String, trim: true, default: '' },
    bcc: { type: String, trim: true, default: '' },
    subject: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const LeaveRequestSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Onboarding', required: true },
    employeeCode: { type: String, trim: true, default: '' },
    employeeName: { type: String, trim: true, required: true },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    employeeEmail: { type: String, trim: true, lowercase: true, default: '' },

    // Snapshot of the reporting manager's name at submission time (same
    // plain-name convention as Onboarding.reportingHead /
    // SalaryRevision.previousReportingHead) — resolved to an email only
    // when a mail actually needs sending (Phase 4), and used server-side to
    // check "is this logged-in Manager actually this request's approver"
    // (Phase 2), the same way isManagerOfRevision() does for Salary Revision.
    reportingHead: { type: String, trim: true, default: '' },

    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },

    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    halfDay: {
      enabled: { type: Boolean, default: false },
      session: { type: String, enum: ['first_half', 'second_half', null], default: null },
    },
    // Computed server-side (working days between dateFrom/dateTo, minus
    // PublicHoliday dates, halved for a half-day request) — never trust a
    // client-supplied duration.
    durationDays: { type: Number, required: true, min: 0 },

    reason: { type: String, trim: true, default: '' },
    document: {
      fileName: { type: String, trim: true, default: '' },
      driveLink: { type: String, trim: true, default: '' },
      uploadedAt: { type: Date, default: null },
    },

    status: {
      type: String,
      enum: ['draft', 'to_approve', 'second_approval', 'approved', 'refused', 'cancelled'],
      default: 'draft',
    },

    managerDecision: { type: DecisionSchema, default: () => ({}) },
    hrDecision: { type: DecisionSchema, default: () => ({}) },
    refusalReason: { type: String, trim: true, default: '' },

    auditLog: { type: [AuditEntrySchema], default: [] },

    mails: {
      submitted:       { type: MailRecordSchema, default: () => ({}) },
      managerApproved: { type: MailRecordSchema, default: () => ({}) },
      approved:        { type: MailRecordSchema, default: () => ({}) },
      refused:         { type: MailRecordSchema, default: () => ({}) },
      cancelled:       { type: MailRecordSchema, default: () => ({}) },
    },

    createdBy: { type: String, trim: true, default: '' },

    // 'app' = created normally through the UI/API; 'odoo_import' = brought
    // in by scripts/importLeaves2026.js. importBatch groups rows from one
    // import run so a bad batch can be rolled back (--rollback <batch>).
    source: { type: String, trim: true, default: 'app' },
    importBatch: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

LeaveRequestSchema.index({ employeeId: 1, status: 1 });
LeaveRequestSchema.index({ dateFrom: 1, dateTo: 1 });
LeaveRequestSchema.index({ importBatch: 1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);
