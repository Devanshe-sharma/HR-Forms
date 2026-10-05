const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeaveTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    color: { type: String, trim: true, default: '#4f46e5' },

    // Who has to sign off before a request filed against this type becomes
    // 'approved' — drives the status pipeline's second-approval step.
    approvalMode: {
      type: String,
      enum: ['none', 'manager', 'hr', 'manager_then_hr'],
      default: 'manager',
    },

    requiresAllocation: { type: Boolean, default: true },
    isPaid: { type: Boolean, default: true },
    allowNegativeBalance: { type: Boolean, default: false },
    requiresDocument: { type: Boolean, default: false },
    // null = no cap on a single request's duration.
    maxDaysPerRequest: { type: Number, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveType', LeaveTypeSchema);
