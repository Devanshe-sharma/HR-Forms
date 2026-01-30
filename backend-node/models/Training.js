const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TrainingSchema = new Schema(
  {
    // ───────────────────────────────────────────────
    // Core training details (topic, date, etc.)
    // ───────────────────────────────────────────────
    topic: {
      type: String,
      required: [true, 'Training topic is required'],
      trim: true,
      minlength: 3,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: 10,
    },
    trainingDate: {
      type: Date,
      required: [true, 'Training date is required'],
    },
    durationHours: {
      type: Number,
      min: 0.5,
      default: 2,
    },
    location: {
      type: String,
      trim: true,
      default: 'Online / Conference Room',
    },

    // ───────────────────────────────────────────────
    // Status & Priority – controls visibility in tabs
    // ───────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'Proposed',       // Management suggestion (visible in Management tab)
        'Under Review',   // HR is checking
        'Approved',
        'Scheduled',
        'Completed',
        'Cancelled',
        'Archived',
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

    // ───────────────────────────────────────────────
    // Origin / Who proposed it
    // ───────────────────────────────────────────────
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    proposedByName: {
      type: String,
      required: true,
    }, // denormalized
    proposedByRole: {
      type: String,
      enum: ['Management', 'HR', 'Employee'],
      required: true,
    },
    proposedAt: {
      type: Date,
      default: Date.now,
    },

    // Management-specific fields (only relevant if proposedByRole = 'Management')
    managementReason: {
      type: String,
      trim: true,
      default: '',
    },

    // ───────────────────────────────────────────────
    // Trainer (internal or external)
    // ───────────────────────────────────────────────
    trainer: {
      employee: {
        type: Schema.Types.ObjectId,
        ref: 'Employee',
      }, // null = external
      name: {
        type: String,
        required: [true, 'Trainer name is required'],
        trim: true,
      },
      department: String,
      designation: String,
      isExternal: {
        type: Boolean,
        default: false,
      },
      externalOrg: String,
      externalContact: String,
    },

    // ───────────────────────────────────────────────
    // Feedbacks from employees (embedded array)
    // ───────────────────────────────────────────────
    feedbacks: [
      {
        employee: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
          required: true,
        },
        employeeName: {
          type: String,
          required: true,
        }, // denormalized

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
        suggestedTopics: String,

        submittedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ───────────────────────────────────────────────
    // Scorecard / Aggregated stats (auto-updated)
    // ───────────────────────────────────────────────
    scorecard: {
      trainerAvgRating: { type: Number, default: 0 },
      totalAttendees: { type: Number, default: 0 },
      attendedCount: { type: Number, default: 0 },
      noShowCount: { type: Number, default: 0 },
      lastCalculated: Date,
    },

    // ───────────────────────────────────────────────
    // Metadata
    // ───────────────────────────────────────────────
    quarter: String,
    financialYear: String,
    archivedAt: Date,
  },
  {
    timestamps: true,
    collection: 'training',  // ← exactly as you want (lowercase)
  }
);

// ───────────────────────────────────────────────
// Indexes – crucial for your tabs & reports
// ───────────────────────────────────────────────
TrainingSchema.index({ status: 1, trainingDate: -1 });
TrainingSchema.index({ proposedBy: 1 });
TrainingSchema.index({ 'trainer.employee': 1 });
TrainingSchema.index({ 'feedbacks.employee': 1 });

// ───────────────────────────────────────────────
// Auto-calculate quarter, FY, and scorecard summary
// ───────────────────────────────────────────────
TrainingSchema.pre('save', function (next) {
  // Quarter & Financial Year
  if (this.trainingDate && (this.isNew || this.isModified('trainingDate'))) {
    const month = this.trainingDate.getMonth() + 1;
    this.quarter = `Q${Math.ceil(month / 3)}`;
    const year = this.trainingDate.getFullYear();
    const fyStart = month >= 4 ? year : year - 1;
    this.financialYear = `FY ${fyStart}-${fyStart + 1}`;
  }

  // Scorecard auto-update when feedbacks change
  if (this.isModified('feedbacks')) {
    const attended = this.feedbacks.filter(f => f.attended).length;
    const ratings = this.feedbacks
      .filter(f => f.overallRating != null)
      .map(f => f.overallRating);

    this.scorecard = {
      trainerAvgRating:
        ratings.length > 0
          ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
          : 0,
      totalAttendees: this.feedbacks.length,
      attendedCount: attended,
      noShowCount: this.feedbacks.length - attended,
      lastCalculated: new Date(),
    };
  }

  next();
});

module.exports = mongoose.model('Training', TrainingSchema);