const mongoose = require("mongoose");

// ============================================================
// CHECKLIST ITEM / GROUP SCHEMAS
// Same shape as Onboarding's checklists — proven structure, keeps the
// frontend checklist UI/logic reusable between the two modules.
// ============================================================

const checklistItemSchema = new mongoose.Schema(
  {
    name:     { type: String, default: "" },
    planDate: { type: Date, default: null },
    doneDate: { type: Date, default: null },
    score:    { type: Number, default: 0 },
    status:   { type: String, default: "Pending" },
    daysLeft: { type: Number, default: 0 },
    checked:  { type: Boolean, default: false },
  },
  { _id: false }
);

const checklistGroupSchema = new mongoose.Schema(
  {
    name:     { type: String, default: "" },
    planDate: { type: Date, default: null },
    itemsList: { type: [checklistItemSchema], default: [] },
  },
  { _id: false }
);

// ============================================================
// MAIN EXIT SCHEMA
// ============================================================

const exitSchema = new mongoose.Schema(
  {
    rowNo: Number,

    // Gates when checklist scoring actually starts — same concept as
    // HiringRequisition's hr_approved_at. Every checklist item sits at
    // "Awaiting Approval" (no score, not counted overdue/pending) until
    // this is set. See exit.js's PATCH /:id/approve.
    hr_approved_at: { type: Date, default: null },

    // ── BASIC INFO ───────────────────────────────────────────
    name: String,
    gender: String,
    persEmail: String,
    mobile: String,
    officialEmail: String,
    dept: String,
    designation: String,
    dept_id:  { type: Number, default: null },
    desig_id: { type: Number, default: null },
    deptLink: String,
    designationLink: String,
    noticePeriod: String,
    transferKnowledge: String,
    reason: String,
    remarks: String,
    // "Type of Exit" — Resignation / Completion of Tenure / Retirement /
    // Demise / Termination / Asked to Leave. Originally added only for
    // legacy CSV import ("Exit Type" column); now also set from the
    // New/Update Exit forms, so it stays a plain String (no enum) to keep
    // accepting whatever free-text value old imported records already have.
    exitType: { type: String, default: "" },
    // "Type of Employment" — Full Time Employment / Contract / Internship /
    // etc. Auto-filled from the matched Onboarding record's employeeCategory
    // at selection time, but kept as free text on both sides so it isn't
    // blocked by an enum mismatch between the two schemas.
    employmentType: { type: String, default: "" },
    // Date of joining, copied over from Onboarding at employee-selection
    // time purely for display — not otherwise used by exit logic.
    joiningDate: { type: Date, default: null },

    // ── CONFIDENTIAL — only collected when exitType === "Asked to Leave".
    // Deliberately NEVER read by any email template/trigger — HR-internal
    // only. See emails/senders and emails/templates: none of them
    // reference these fields, and they must stay that way.
    reasonAskedToLeave: { type: String, default: "" },
    reasonAskedToLeaveDetail: { type: String, default: "" },

    // ── EXIT TIMELINE ────────────────────────────────────────
    resignationDate: Date,
    plannedExitDate: Date,
    leftDate: Date,

    // "Serving Notice Period" | "Already Left" | "Left" | "Not Exiting" | "Exit Cancelled"
    exitStatus: String,

    // ── LINKS & CC ───────────────────────────────────────────
    employeesInCc: { type: [String], default: [] },

    // ── CALCULATED ───────────────────────────────────────────
    totalTasks:     { type: Number, default: 0 },
    doneInTime:     { type: Number, default: 0 },
    doneButDelayed: { type: Number, default: 0 },
    tasksDue:       { type: Number, default: 0 },
    tasksOverdue:   { type: Number, default: 0 },
    notYetDue:      { type: Number, default: 0 },
    fmsScore:       { type: Number, default: 0 },
    fmsStatus:      { type: String, default: "Open" },

    // ── AUTO EMAILS ──────────────────────────────────────────
    // One-time sends, same sticky pattern as Onboarding: the *SentAt
    // timestamp is the source of truth and is never cleared/overwritten
    // once set, regardless of what a later form submission sends.
    autoExitEmail:       { type: Boolean, default: false },
    autoExitEmailSentAt: { type: Date, default: null },

    autoExitEmailDept:       { type: Boolean, default: false },
    autoExitEmailDeptSentAt: { type: Date, default: null },

    autoReminderEmail:       { type: Boolean, default: false },
    autoReminderEmailSentAt: { type: Date, default: null },

    autoInstructionsToAllEmail:       { type: Boolean, default: false },
    autoInstructionsToAllEmailSentAt: { type: Date, default: null },

    // ── CHECKLISTS ───────────────────────────────────────────
    checkLists: { type: [checklistGroupSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exit", exitSchema);