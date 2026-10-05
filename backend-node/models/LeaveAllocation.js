const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// employeeId is the real link (ref Onboarding, same convention as
// OutOfOffice.person.employeeId) — employeeCode/employeeName/department are
// a point-in-time snapshot for display, matching how SalaryRevision keeps
// its own employeeCode/employeeName copies rather than joining every read.
const LeaveAllocationSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Onboarding', required: true },
    employeeCode: { type: String, trim: true, default: '' },
    employeeName: { type: String, trim: true, required: true },
    department: { type: String, trim: true, default: '' },

    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },

    days: { type: Number, required: true, min: 0 },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, default: null },

    accrual: {
      enabled: { type: Boolean, default: false },
      daysPerPeriod: { type: Number, default: 0 },
      period: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
      lastAccruedAt: { type: Date, default: null },
    },

    status: { type: String, enum: ['approved', 'pending'], default: 'approved' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: String, trim: true, default: '' },

    // 'app' = created normally through the UI/API; 'odoo_import' = brought
    // in by scripts/importLeaves2026.js. importBatch groups rows from one
    // import run so a bad batch can be rolled back (--rollback <batch>).
    source: { type: String, trim: true, default: 'app' },
    importBatch: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

LeaveAllocationSchema.index({ employeeId: 1, leaveTypeId: 1 });
LeaveAllocationSchema.index({ importBatch: 1 });

module.exports = mongoose.model('LeaveAllocation', LeaveAllocationSchema);
