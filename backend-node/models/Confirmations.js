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
    // Reference to Employee collection
    employeeId : { type: Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },

    // Snapshot of Employee fields (so display works even if Employee changes)
    employeeCode     : { type: String, default: '' },  // Employee.employee_id
    employeeName     : { type: String, default: '' },  // Employee.full_name
    department       : { type: String, default: '' },  // Employee.department
    designation      : { type: String, default: '' },  // Employee.designation
    joiningDate      : { type: String, default: '' },  // Employee.joining_date  (kept as string)
    level            : { type: Number, default: 1 },   // Employee.level
    email            : { type: String, default: '' },  // Employee.official_email
    reportingManager : { type: String, default: '' },
    pmsScore         : { type: Number, default: null },

    // ── Workflow ────────────────────────────────────────────────────────────────
    currentStatus : {
      type    : String,
      enum    : ['probation', 'confirmed', 'extended', 'not_confirmed'],
      default : 'probation',
    },

    stage : {
      type    : String,
      enum    : ['pending_manager', 'pending_management', 'completed', 'on_hold'],
      default : 'pending_manager',
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

    // Full audit trail
    history : [HistorySchema],
  },
  { timestamps: true },
);

ConfirmationSchema.index({ stage: 1 });
ConfirmationSchema.index({ currentStatus: 1 });
ConfirmationSchema.index({ stage: 1, reviewDate: 1 });  // for cron job

module.exports = mongoose.model('Confirmations', ConfirmationSchema);