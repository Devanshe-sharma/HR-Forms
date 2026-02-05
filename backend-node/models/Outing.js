const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OutingSchema = new Schema(
  {
    // ───────────────────────────────────────────────
    // Core outing details
    // ───────────────────────────────────────────────
    topic: {
      type: String,
      required: [true, 'Outing/Event name is required'],
      trim: true,
      minlength: 3,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: 10,
    },
    tentativePlace: {
      type: String,
      trim: true,
      default: '',
    },
    tentativeBudget: {
      type: Number,
      min: 0,
      default: 0,
    },
    tentativeDate: {
      type: Date,
      required: false,
      default: null,
    },

    // ───────────────────────────────────────────────
    // Status & Priority (similar to training)
    // ───────────────────────────────────────────────
    status: {
        type: String,
        enum: [
          'Proposed',    // HR proposed
          'Suggested',   // ← add this line
          'Scheduled',
          'Rejected',
          'Completed',
          'Archived'
        ],
        default: 'Proposed',
        index: true,
      },
    priority: {
      type: String,
      enum: ['P1', 'P2', 'P3'],
      default: 'P3',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },

    // ───────────────────────────────────────────────
    // Origin / Proposed by
    // ───────────────────────────────────────────────
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: false,
    },
    proposedByName: {
      type: String,
      required: true,
      default: 'Anonymous',
    },
    proposedByRole: {
      type: String,
      enum: ['Management', 'HR', 'Employee'],
      required: true,
    },
    proposedAt: {
      type: Date,
      default: Date.now,
    },

    // ───────────────────────────────────────────────
    // Metadata (same as training)
    // ───────────────────────────────────────────────
    quarter: { type: String, index: true },
    financialYear: { type: String, index: true },
    archivedAt: Date,

    // ───────────────────────────────────────────────
    // Feedback & Attendance
    // ───────────────────────────────────────────────
    feedbacks: [
      {
        employee: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
        },
        employeeName: {
          type: String,
          required: true,
        },
        department: String,
        designation: String,
        attended: {
          type: Boolean,
          default: false,
        },
        overallRating: {
          type: Number,
          min: 1,
          max: 5,
        },
        contentQuality: {
          type: Number,
          min: 1,
          max: 5,
        },
        whatWasMissing: String,
        howHelpful: String,
        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ───────────────────────────────────────────────
    // Discrepancy tracking (missing feedback after attending)
    // ───────────────────────────────────────────────
    discrepancies: [
      {
        employee: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
        },
        employeeName: String,
        reason: {
          type: String,
          default: 'No feedback submitted after attending',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'outing',
  }
);

// Auto-calculate quarter & financial year
OutingSchema.pre('save', async function () {
  if (this.tentativeDate && (this.isNew || this.isModified('tentativeDate'))) {
    const date = new Date(this.tentativeDate);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    this.quarter = `Q${Math.ceil(month / 3)}`;
    const fyStart = month >= 4 ? year : year - 1;
    this.financialYear = `FY ${fyStart}-${fyStart + 1}`;
  }
});

// Auto-archive after quarter ends (optional middleware or cron later)
module.exports = mongoose.model('Outing', OutingSchema);