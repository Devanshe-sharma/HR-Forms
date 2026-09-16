const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── History entry ─────────────────────────────────────────────────────────────
const HistorySchema = new Schema(
  {
    status         : { type: String, required: true },   // probation | confirmed | extended | not_confirmed
    reason         : { type: String, default: '' },
    monthsExtended : { type: Number, default: null },    // only when status = extended
    changedBy      : { type: String, default: '' },      // 'manager' | 'management' | 'system'
    changedByName  : { type: String, default: '' },
    date           : { type: Date,   default: Date.now },
  },
  { _id: false },
);

// ── Main schema ───────────────────────────────────────────────────────────────
const ConfirmationSchema = new Schema(
  {
    // Reference to the Onboarding collection — the single employee master.
    // (Previously referenced a separate "Employee" collection that no
    // longer serves as the source of truth.)
    employeeId : { type: Schema.Types.ObjectId, ref: 'Onboarding', required: true, unique: true },

    // Snapshot of employee fields, kept fresh via the backend's
    // refreshSnapshot() sync on every load — so display works even between
    // syncs, but never drifts stale for long.
    employeeCode     : { type: String, default: '' },  // stringified Onboarding _id
    employeeName     : { type: String, default: '' },  // Onboarding.name
    department       : { type: String, default: '' },  // Onboarding.dept
    designation      : { type: String, default: '' },  // Onboarding.designation
    joiningDate      : { type: String, default: '' },  // Onboarding.joinedDate (kept as string)
    level            : { type: Number, default: 1 },   // not tracked in Onboarding today
    email            : { type: String, default: '' },  // Onboarding.officialEmail
    reportingManager : { type: String, default: '' },  // Onboarding.reportingHead
    pmsScore         : { type: Number, default: null },

    // ── Workflow ────────────────────────────────────────────────────────────────
    currentStatus : {
      type    : String,
      enum    : ['probation', 'confirmed', 'extended', 'not_confirmed'],
      default : 'probation',
    },

    // 'not_due' — the initial state for every joiner: they're on probation,
    // but the confirmation review itself hasn't opened up for
    // manager/management action yet (that only starts once tenure hits 5
    // months — see advanceStageIfDue() in routes/confirmations.js). Once a
    // record leaves 'not_due' it's never sent back to it automatically.
    // 'pending_hr' (added 2026-09-16) — sits between Management deciding
    // confirmed/not_confirmed and the record actually closing out: HR
    // still has to upload the confirmation/extension letter before this
    // reaches 'completed'. An 'extended' decision skips this entirely and
    // goes straight to 'on_hold' as before — there's nothing for HR to do
    // on an extension, it just reopens automatically via the cron.
    stage : {
      type    : String,
      enum    : ['not_due', 'pending_manager', 'pending_management', 'pending_hr', 'completed', 'on_hold'],
      default : 'not_due',
    },

    // ── Extension tracking (when probation is extended) ──────────────────────────
    extendedMonths : { type: Number, default: null },   // number of months extended
    extendedTill   : { type: Date,   default: null },   // extension end date
    reviewDate     : { type: Date,   default: null },   // when to re-evaluate

    // Manager decision (step 1)
    managerDecision : {
      status         : { type: String, default: null },
      reason         : { type: String, default: '' },
      monthsExtended : { type: Number, default: null },
      submittedAt    : { type: Date,   default: null },
    },

    // Management final decision (step 2)
    managementDecision : {
      status         : { type: String, default: null },
      reason         : { type: String, default: '' },
      monthsExtended : { type: Number, default: null },
      submittedAt    : { type: Date,   default: null },
    },

    // HR final action (step 3, added 2026-09-16) — HR uploads the
    // confirmation/extension letter to close the record out. Only ever
    // set once, at the same moment stage moves 'pending_hr' -> 'completed'.
    hrAction : {
      document : {
        fileName  : { type: String, default: '' },
        driveLink : { type: String, default: '' },
      },
      submittedAt : { type: Date, default: null },
    },

    // ── Confirmation mail-queue timing (added 2026-09-16) ────────────────────────
    // Mirrors Salary Revision's managerRequestedAt/managerEscalationSentAt
    // convention exactly — set once, the moment each mail actually queues
    // (not retroactively for records already open before this feature
    // existed, so no legacy backlog suddenly starts generating mail).
    managerRequestedAt      : { type: Date, default: null }, // when Mail 1 (Manager Request) queued
    managerReminderSentAt   : { type: Date, default: null }, // gate — Manager Reminder is one-shot
    managementRequestedAt   : { type: Date, default: null }, // when Mail 2 (Management Request) queued
    managementReminderSentAt: { type: Date, default: null }, // gate — Management Reminder is one-shot

    // Full audit trail
    history : [HistorySchema],
  },
  { timestamps: true },
);

ConfirmationSchema.index({ stage: 1 });
ConfirmationSchema.index({ currentStatus: 1 });
ConfirmationSchema.index({ stage: 1, reviewDate: 1 });  // for cron job

module.exports = mongoose.model('Confirmations', ConfirmationSchema);