const mongoose = require('mongoose');
const { nextSequence } = require('./Counter');

// Category choices depend on which type of escalation this is — kept here
// (not just in the frontend) so the API rejects a category that doesn't
// belong to the chosen type even if a future caller isn't the current form.
const GENERAL_CATEGORY_OPTIONS = [
  'Reminder', 'POSH', 'Misbehaviour', 'Absent from Work', 'Refused Offer',
  'Refused to Join', 'Blacklisted', 'Good Work', 'Provided a Reference', 'Other',
];
const DEPARTMENT_CATEGORY_OPTIONS = [
  'Employee Files/Data incomplete', 'Payroll incorrect', 'POSH Case', 'Problem Without Solution',
];

const targetPersonSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
    name: { type: String, required: true },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { _id: false }
);

const escalationSchema = new mongoose.Schema(
  {
    // Human-facing case number, assigned once on first save (see the
    // pre('save') hook below) — never regenerated or reused.
    caseNumber: { type: String, unique: true, sparse: true },

    // Snapshotted at creation time, same reasoning as Referral.js's
    // denormalized requisition fields — stays meaningful even if the
    // creator's own Onboarding record changes later.
    createdBy: {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
      name: { type: String, required: true },
      email: { type: String, default: '' },
      mobile: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
    },

    escalationFor: {
      type: String,
      enum: ['Department Related', 'General'],
      required: true,
    },
    // Always populated now — every escalation names the employee(s) it
    // concerns, regardless of type.
    targetEmployees: {
      type: [targetPersonSchema],
      validate: v => Array.isArray(v) && v.length > 0,
    },

    category: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          const allowed = this.escalationFor === 'General' ? GENERAL_CATEGORY_OPTIONS : DEPARTMENT_CATEGORY_OPTIONS;
          return allowed.includes(v);
        },
        message: props => `"${props.value}" is not a valid category for this escalation type.`,
      },
    },

    description: { type: String, required: true, trim: true },
    dateOccurred: { type: Date, required: true },

    // Email addresses CC'd on the notification mail — the filer picks these
    // in the Classification step, pre-populated with everyone holding the
    // 'Management' role.
    cc: { type: [String], default: [] },
  },
  { timestamps: true }
);

escalationSchema.index({ createdAt: -1 });
escalationSchema.index({ category: 1 });
escalationSchema.index({ 'createdBy.employeeId': 1 });

// Async pre-hooks must NOT also take a `next` callback param — Mongoose's
// middleware runner (Kareem) picks callback-style vs promise-style based on
// the function's declared arity, and an async function that both returns a
// promise AND expects to call next() itself gets no real `next` passed in
// (throws "next is not a function"). Just await; no next() call needed.
escalationSchema.pre('save', async function () {
  if (this.isNew && !this.caseNumber) {
    const n = await nextSequence('escalation');
    this.caseNumber = `ESC-${String(n).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Escalation', escalationSchema);
module.exports.GENERAL_CATEGORY_OPTIONS = GENERAL_CATEGORY_OPTIONS;
module.exports.DEPARTMENT_CATEGORY_OPTIONS = DEPARTMENT_CATEGORY_OPTIONS;
