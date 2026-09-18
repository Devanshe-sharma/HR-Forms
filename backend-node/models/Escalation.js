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
  Other: 'Miscellaneous',
};
const CATEGORY_CODES = Object.keys(CATEGORY_NAMES);

// Hardcoded "category description" suggestions per department, keyed by the
// same category codes above. "Default" is the universal set — it applies to
// every department (the business rule that named it and "All" the same
// thing) on top of whatever that department adds of its own. "Other" has no
// suggestions on purpose: the filer types their own description for it.
const CATEGORY_DESCRIPTIONS = {
  Default: {
    T: ['Delayed Services, Non / Late Performance'],
    Q: ['Absence of Detail Orientation, Work done but NOT to Quality'],
    C: ['Actions Leading to Reduced Profit / Increased Expense / Reduced Cash Flow'],
    P: ['Non-Compliance with Processes, Non Reporting or Not Filling Data'],
    H: [
      'False Reporting, Fake Bills, Hiding/Failing to Report Bad News, Financial Impropriety, Non-Ethical Conduct',
      'Data Fabrication, Dishonest Behaviour, Fraud, Fake Bills, etc.',
    ],
    Ext: [
      'Complaints / Escalations by Clients, Customers, BO Members, Vendors, etc.',
      'Customer, Visitor, Vendor, Member Complaint — salesperson behaviour, Unresponsiveness, Overcommitment, Promise Not Fulfilled, etc.',
    ],
    Culture: [
      'Team/Member absent, Customer Meeting Missed, Rude Behaviour, Lack of Commitment, Problem Posing Without Providing Solution — e.g. Complaining behind back, Not working as a Team, Pitching one against other, Taking Credit but Not Claiming Blame',
    ],
    POSH: ['POSH Case'],
    'Ext Factors': [
      'Bad Debt, Non-Delivery by Vendor, Toxic Customer, Stakeholder POSH, Litigation notice received, Delay/No response from Client, Change of Requirement, Project/Position put on hold without intimation',
    ],
  },
  Admin: {
    T: ['Delayed Services, AMC renewal delayed, Utility bill payment delayed, Non / Late renewals'],
    Q: ['Housekeeping complaint, Office not clean, Pantry/Stationery not replenished daily, Facility Breakdown, Vehicle unavailable, Security Lapse, Contractual Errors'],
    C: ['Assets missing, Overpayment, Overexpense, Cash variance'],
    P: ['Event held without advance-info email, HR and Admin both unavailable / Staff NA, Single Vendor Dependency, Contracts Expired, Policy/Dept Note reviews overdue, Process outdated/missing/buggy or not followed'],
    H: ['False Reporting, Fake Bills, Hiding/Failing to Report Bad News, Financial Impropriety'],
    Ext: ['Visitor complaint.'],
  },
  SysAdmin: {
    T: ['Tickets Overdue'],
    Q: ['System downtime, Backup Failure, Security Incident, Unauthorised Access, Data Loss'],
  },
  HR: {
    T: ['Delayed salary processing, etc.'],
    Q: ['Bad Hires'],
    C: ['Payroll incorrect, Overspending on Events, etc.'],
    P: ['Employee Files/Data incomplete or missing, Statutory non-compliance'],
  },
  Accounts: {
    T: ['Delayed Invoicing, Delayed Reporting, Delayed Vendor Payments, Delayed Month Closing, Regulatory filing delayed, etc.'],
    Q: ['Errors in Accounting Entries, Vendor quotation missing, Purchase Order Error'],
    C: ['Invoice Errors, Duplicate Payments, Wrong GST Treatment, CashFlow Mismanagement, Investments not done timely, Loss due to non-compliance or wrong process, etc.'],
    P: ['Incorrect Ledger Entry, etc.'],
  },
  Sales: {
    T: ['Proposal Delays — not submitted on time, Customer response delayed, Follow up missed'],
    Q: ['Errors in Proposal'],
    C: ['Incorrect Pricing / Scope / Commitment'],
    P: ['Incorrect Sales Data — e.g. missing customer data, CRM not updated, Missing Sales Docs, Contract unsigned after work started'],
  },
  Marketing: {
    T: ['Tasks delayed / not done'],
    Q: ['Content containing typos/errors, Wrong branding/logo usage, Broken website links, Website down, Wrong contact details published'],
    C: ['Excessive spending on services'],
  },
  Operations: {
    T: ['Activity started/completed late, Milestone Missed, Critical Path Delay, etc.'],
    C: ['Cost Overrun, Excess Travel Cost, Money Wastage, Material Wastage, Scope Deviation, Unauthorised Work Done'],
    Q: ['Work Quality Poor, SLA breach, Deliverable Omitted, Rework Required, Audit Non-conformance, GPS coordinates/Photos missing'],
    P: ['Reports delayed, No Feedback, Change request not approved, Risks Not Identified, Process Deviation, Document control failure'],
  },
  'Leadership / CEO Office': {
    T: ['Delayed/missed strategic milestone, Business Development/Partnership Delays'],
    C: ['Revenue/Profit/CashFlow Target Shortfall beyond threshold, Customer churn'],
    Q: ['Strategic Gaps, Over-Dependence on 1 Contract/Customer/Vendor'],
    Culture: ['Loss of key employee, Major Reputation Issue, Unresolved inter-department conflict, Non-Appreciation and Awards, Not Setting Aspirations or Growth Opportunities, Not Providing Autonomy'],
  },
};

// The hardcoded table above uses shorthand department names (HR, Admin,
// etc.) — this maps the real Onboarding department strings that don't
// already match one of those keys verbatim.
const CATEGORY_DEPARTMENT_ALIASES = {
  'Human Resources': 'HR',
};

// Every department gets the Default/universal descriptions for a category
// in addition to whatever it adds of its own — same-named entries from both
// are combined rather than one replacing the other.
function getCategoryDescriptionOptions(department, categoryCode) {
  const key = CATEGORY_DEPARTMENT_ALIASES[department] || department;
  const deptOptions = CATEGORY_DESCRIPTIONS[key]?.[categoryCode] || [];
  const defaultOptions = CATEGORY_DESCRIPTIONS.Default[categoryCode] || [];
  return Array.from(new Set([...deptOptions, ...defaultOptions]));
}

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
    // The specific description picked (or typed, for category "Other") from
    // the hardcoded per-department suggestions in CATEGORY_DESCRIPTIONS.
    categoryDescription: { type: String, required: true, trim: true },

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
module.exports.CATEGORY_DESCRIPTIONS = CATEGORY_DESCRIPTIONS;
module.exports.CATEGORY_DEPARTMENT_ALIASES = CATEGORY_DEPARTMENT_ALIASES;
module.exports.getCategoryDescriptionOptions = getCategoryDescriptionOptions;
