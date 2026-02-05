const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Training Schema
 * Handles the lifecycle of a training session from Management suggestion
 * to HR scheduling and final employee feedback.
 */
const TrainingSchema = new Schema(
  {
    // ───────────────────────────────────────────────
    // Core training details
    // ───────────────────────────────────────────────
    // ───────────────────────────────────────────────
// Core training details
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
  required: [false, 'Training date is required'],
  default: null,
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
mode: {
  type: String,
  enum: ['Online', 'In-Person', 'Hybrid'],
  default: 'Online',
  trim: true,
},
venue: {
  type: String,
  trim: true,
  default: '',
},
meetingLink: {
  type: String,
  trim: true,
  default: '',
},

    // ───────────────────────────────────────────────
    // Status & Priority
    // ───────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'Proposed',       // Management suggestion
        'Under Review',   // HR is checking
        'Approved',       // Ready to be scheduled
        'Scheduled',      // Date finalized
        'Completed',      // Training over
        'Cancelled',
        'Archived',       // Past date auto-archive
        'Rejected'        // Management/HR rejected
      ],
      default: 'Proposed',
      index: true,
    },
    reason: {
        type: String,
        trim: true,
        default: '',
      },
    priority: {
      type: String,
      enum: ['P1', 'P2', 'P3'],
      default: 'P3',
      index: true,
    },

    // ───────────────────────────────────────────────
    // Origin Information
    // ───────────────────────────────────────────────
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: false, 
    },
    proposedByName: {
      type: String,
      required: true,
      default: 'System',
    },
    proposedByRole: {
      type: String,
      enum: ['Management', 'HR', 'Employee'],
      required: true,
      default: 'HR',
    },
    proposedAt: {
      type: Date,
      default: Date.now,
    },
    managementReason: {
      type: String,
      trim: true,
      default: '',
    },

    // ───────────────────────────────────────────────
    // Trainer Details
    // ───────────────────────────────────────────────
    trainer: {
      employee: {
        type: Schema.Types.ObjectId,
        ref: 'Employee',
      }, 
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
      externalContact: String, // Mobile or Email
    },

    // ───────────────────────────────────────────────
    // Feedback & Attendance Log
    // ───────────────────────────────────────────────
    feedbacks: [
      {
        employee: {
          type: Schema.Types.ObjectId,
          ref: 'Employee',
          // required: true,
        },
        employeeName: {
          type: String,
          required: true,
        },
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
    // Automated Stats (Scorecard)
    // ───────────────────────────────────────────────
    scorecard: {
      trainerAvgRating: { type: Number, default: 0 },
      totalAttendees: { type: Number, default: 0 },
      attendedCount: { type: Number, default: 0 },
      noShowCount: { type: Number, default: 0 },
      lastCalculated: Date,
    },

    // ───────────────────────────────────────────────
    // Metadata for Filtering
    // ───────────────────────────────────────────────
    quarter: { type: String, index: true },
    financialYear: { type: String, index: true },
    archivedAt: Date,
  },
  {
    timestamps: true,
    collection: 'training',
  }
);

// ───────────────────────────────────────────────
// Indexes
// ───────────────────────────────────────────────
TrainingSchema.index({ status: 1, trainingDate: -1 });
TrainingSchema.index({ financialYear: 1, quarter: 1 });
TrainingSchema.index({ 'trainer.name': 1 });

// ───────────────────────────────────────────────
// Middleware: Pre-save logic
// ───────────────────────────────────────────────
TrainingSchema.pre('save', function (next) {
  console.log('===== TRAINING PRE-SAVE HOOK IS NOW RUNNING ====='); // <--- MUST SEE THIS

  const doc = this;

  if (doc.trainingDate && (doc.isNew || doc.isModified('trainingDate'))) {
    const date = new Date(doc.trainingDate);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    doc.trainingDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    console.log('Month detected:', month, 'for date:', doc.trainingDate); // <--- DEBUG

    let quarter;
    if (month >= 4 && month <= 6) quarter = 'Q1';
    else if (month >= 7 && month <= 9) quarter = 'Q2';
    else if (month >= 10 && month <= 12) quarter = 'Q3';
    else quarter = 'Q4';

    doc.quarter = quarter;

    const fyStart = month >= 4 ? year : year - 1;
    doc.financialYear = `FY ${fyStart}-${fyStart + 1}`;

    console.log(`Assigned: quarter=${doc.quarter}, fy=${doc.financialYear}`); // <--- DEBUG
  } else {
    console.log('No trainingDate change or missing – skipping quarter calc');
  }

  // 2. Auto-calculate Scorecard stats if feedbacks are updated
  if (doc.isModified('feedbacks')) {
    const total = doc.feedbacks.length;
    const attended = doc.feedbacks.filter(f => f.attended).length;
    
    const validRatings = doc.feedbacks
      .filter(f => f.overallRating != null)
      .map(f => f.overallRating);

    const avgRating = validRatings.length > 0 
      ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1))
      : 0;

    doc.scorecard = {
      trainerAvgRating: avgRating,
      totalAttendees: total,
      attendedCount: attended,
      noShowCount: total - attended,
      lastCalculated: new Date(),
    };
  }

  next();
});

module.exports = mongoose.model('Training', TrainingSchema);