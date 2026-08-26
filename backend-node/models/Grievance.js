const mongoose = require('mongoose');
const { nextSequence } = require('./Counter');

// Category → allowed subcategories. Kept here (not just in the frontend)
// so the API rejects a category that doesn't exist even if a future
// caller isn't the current form.
const CATEGORY_TAXONOMY = {
  'Harassment or misconduct': ['Verbal harassment', 'Physical harassment', 'Sexual harassment', 'Bullying / intimidation', 'Other'],
  'Workplace conflict': ['Conflict with colleague', 'Conflict with manager', 'Team dynamics', 'Other'],
  'Unfair treatment': ['Discrimination', 'Favoritism', 'Unequal workload', 'Denied opportunity', 'Other'],
  'Policy violation': ['Attendance policy', 'Code of conduct', 'Confidentiality / data', 'Safety violation', 'Other'],
  'Compensation & benefits': ['Salary discrepancy', 'Benefits issue', 'Reimbursement delay', 'Other'],
  Other: ['Other'],
};

const SEVERITY_RESOLUTION_DAYS = { Low: 2, Medium: 5, Critical: 7 };

// Multiple people a grievance can concern — snapshotted at filing time,
// same reasoning as Escalation.js's targetPersonSchema.
const targetPersonSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
    name: { type: String, required: true },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    email: { type: String, default: '' },
    reportingManager: { type: String, default: '' },
  },
  { _id: false }
);

const timelineEntrySchema = new mongoose.Schema(
  {
    who: { type: String, required: true },
    note: { type: String, required: true },
    statusAtTime: { type: String, default: '' },
    when: { type: Date, default: Date.now },
  },
  { _id: false }
);

const grievanceSchema = new mongoose.Schema(
  {
    // Human-facing case number, assigned once on first save (see the
    // pre('save') hook below) — never regenerated or reused.
    caseNumber: { type: String, unique: true, sparse: true },

    filedBy: {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
      name: { type: String, required: true },
      email: { type: String, default: '' },
      mobile: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
    },

    concerning: {
      type: [targetPersonSchema],
      validate: v => Array.isArray(v) && v.length > 0,
    },

    category: { type: String, enum: Object.keys(CATEGORY_TAXONOMY), required: true },
    subcategory: { type: String, default: '' },
    description: { type: String, required: true, trim: true },

    severity: { type: String, enum: ['Low', 'Medium', 'Critical'], required: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },

    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true }
);

grievanceSchema.index({ createdAt: -1 });
grievanceSchema.index({ 'filedBy.employeeId': 1 });
grievanceSchema.index({ status: 1 });

// Async pre-hooks must NOT also take a `next` callback param — Mongoose's
// middleware runner (Kareem) picks callback-style vs promise-style based on
// the function's declared arity, and an async function that both returns a
// promise AND expects to call next() itself gets no real `next` passed in
// (throws "next is not a function"). Just await; no next() call needed.
grievanceSchema.pre('save', async function () {
  if (this.isNew && !this.caseNumber) {
    const n = await nextSequence('grievance');
    this.caseNumber = `GRV-${String(n).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Grievance', grievanceSchema);
module.exports.CATEGORY_TAXONOMY = CATEGORY_TAXONOMY;
module.exports.SEVERITY_RESOLUTION_DAYS = SEVERITY_RESOLUTION_DAYS;
