const mongoose = require('mongoose');
const { nextSequence } = require('./Counter');

// Universal category list — same across all three modes (Employee, External,
// BO). Kept here (not just in the frontend) so the API rejects a code that
// doesn't exist even if a future caller isn't the current form. Names are
// duplicated from the frontend's CATEGORIES list so emails (which render
// server-side) can show "T — Timeliness-Reliability" instead of a bare code.
const CATEGORY_NAMES = {
  T: 'Timeliness-Reliability',
  Q: 'Quality',
  C: 'Profit-Economy-CashFlow',
  P: 'Process-Reporting-Data',
  H: 'Honesty-Ethics',
  Ext: 'External Escalation',
  Culture: 'Culture-Leadership Behaviour',
  POSH: 'POSH Case',
  'Ext Factors': 'External Factors Log',
  Other: 'Any Other',
};
const CATEGORY_CODES = Object.keys(CATEGORY_NAMES);

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

    // Employee: about a named employee. External: logged on behalf of an
    // external party, but still against a named employee. BO: about a BO
    // member/client/vendor/referrer — no named employee at all.
    escalationFor: {
      type: String,
      enum: ['Employee', 'External', 'BO'],
      required: true,
    },

    // Required for Employee/External, empty for BO — enforced in the route,
    // not here, since Mongoose validators don't get a clean shot at
    // cross-field conditionals as readably as an explicit route check.
    targetEmployees: { type: [targetPersonSchema], default: [] },

    department: { type: String, required: true },

    // External mode only.
    reportedBy: { type: String, default: '' },
    company: { type: String, default: '' },

    // Optional, any mode.
    project: { type: String, default: '' },
    event: { type: String, default: '' },

    category: { type: String, enum: CATEGORY_CODES, required: true },

    description: { type: String, required: true, trim: true },
    dateOccurred: { type: Date, required: true },

    // Email addresses additionally notified on the notification mail — the
    // hardcoded Management group and the concerned employee always get it
    // regardless of what's (or isn't) in here.
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
module.exports.CATEGORY_CODES = CATEGORY_CODES;
module.exports.CATEGORY_NAMES = CATEGORY_NAMES;
