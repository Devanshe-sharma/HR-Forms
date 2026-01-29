const mongoose = require('mongoose');

const TrainingProposalSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: [true, 'Training topic is required'],
      trim: true,
    },
    desc: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    trainerType: {
      type: String,
      enum: ['internal', 'external'],
      required: true,
    },
    trainerName: {
      type: String,
      required: [true, 'Trainer name is required'],
      trim: true,
    },
    trainerDept: {
      type: String,
      trim: true,
    },
    trainerDesig: {
      type: String,
      trim: true,
    },
    external: {
      type: {
        source: String,
        org: String,
        mobile: String,
        email: String,
      },
      default: undefined,
    },

    // Updated: added 'Archived' status
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Scheduled', 'Archived'],
      default: 'Pending',
    },

    date: {
      type: String,           // "31-Jan-2026 11:36 PM"
      default: '',
    },

    reason: {
      type: String,
      default: '',
      trim: true,
    },

    // Optional but very useful for filtering/archiving
    quarter: {
      type: String,
      enum: ['Q1', 'Q2', 'Q3', 'Q4', null],
      default: null,
    },
    financialYear: {
      type: String,
      default: null,          // e.g. "FY 2025-2026"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // Optional: store when it was archived
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'TrainingProposal',
  }
);

// Pre-save hook: auto-calculate quarter & financial year when date is set
TrainingProposalSchema.pre('save', function (next) {
  if (this.date && this.isModified('date')) {
    try {
      const [day, mon, yearTime] = this.date.split(/[- :]/);
      const year = parseInt(yearTime.split(' ')[0]);
      const month = new Date(`${mon} ${day}, ${year}`).getMonth() + 1;

      this.quarter = `Q${Math.ceil(month / 3)}`;

      const fyStart = month >= 4 ? year : year - 1;
      this.financialYear = `FY ${fyStart}-${fyStart + 1}`;
    } catch (e) {
      console.warn('Could not parse date for quarter/FY:', this.date);
    }
  }
  next();
});

module.exports = mongoose.model('TrainingProposal', TrainingProposalSchema);