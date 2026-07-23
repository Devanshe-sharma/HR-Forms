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
    // Additive field for legacy import — e.g. "Resignation". Optional,
    // doesn't affect existing documents or the New/Update Exit forms.
    exitType: { type: String, default: "" },

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