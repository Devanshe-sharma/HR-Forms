const mongoose = require('mongoose');

const TrainingProposalSchema = new mongoose.Schema(
  {
    // 1. HR PROPOSAL OBJECT: Primary training details
    hr_info: {
      topic: { 
        type: String, 
        required: [true, 'Training topic is required'], 
        trim: true 
      },
      desc: { 
        type: String, 
        required: [true, 'Description is required'], 
        trim: true 
      },
      trainerType: { 
        type: String, 
        enum: ['internal', 'external'], 
        default: 'internal' 
      },
      trainerName: { 
        type: String, 
        default: '', 
        trim: true 
      }, // Made optional to support Management suggestions
      trainerDept: { type: String, trim: true },
      trainerDesig: { type: String, trim: true },
      external: {
        source: String,
        org: String,
        mobile: String,
        email: String,
      },
    },

    // 2. MANAGEMENT OBJECT: Approvals, Priority, and Remarks
    mgmt_info: {
      status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Scheduled', 'Archived'],
        default: 'Pending',
      },
      priority: { 
        type: String, 
        enum: ['P1', 'P2', 'P3', null], 
        default: null 
      },
      reason: { 
        type: String, 
        default: '', 
        trim: true 
      }, // Used for Suggestions or Rejection remarks
      isSuggestion: { 
        type: Boolean, 
        default: false 
      },
    },

    // 3. FEEDBACK OBJECT: Array of employee ratings
    feedback_info: [
      {
        employeeName: String,
        overallRating: Number, // 1-5
        contentQuality: Number, // 1-5
        missingContent: String,
        helpfulPoints: String,
        suggestedTopics: String,
        submittedAt: { type: Date, default: Date.now },
      },
    ],

    // 4. SCORECARD OBJECT: Trainer rewards and attendee penalties
    scorecard_info: {
      trainerScore: { 
        type: Number, 
        default: 0 
      },
      attendees: [
        {
          employeeName: String,
          attended: { type: Boolean, default: false },
          scoreImpact: { type: Number, default: 0 }, // e.g., -1 for no-show
        },
      ],
      finalized: { 
        type: Boolean, 
        default: false 
      },
    },

    // --- SHARED METADATA ---
    date: { 
      type: String, 
      default: '' 
    }, // Format: "31-Jan-2026 11:36 PM"
    quarter: { 
      type: String, 
      enum: ['Q1', 'Q2', 'Q3', 'Q4', null], 
      default: null 
    },
    financialYear: { 
      type: String, 
      default: null 
    },
    archivedAt: { 
      type: Date, 
      default: null 
    },
  },
  {
    timestamps: true,
    collection: 'TrainingProposal',
  }
);


// Remove the 'next' argument and use an async function
TrainingProposalSchema.pre('save', async function () {
  if (this.date && this.isModified('date')) {
    try {
      const parts = this.date.split(/[- :]/); 
      const day = parseInt(parts[0]);
      const monStr = parts[1];
      const year = parseInt(parts[2]);

      const monthMap = { 
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, 
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 
      };
      
      const month = monthMap[monStr] + 1;
      this.quarter = `Q${Math.ceil(month / 3)}`;
      const fyStart = month >= 4 ? year : year - 1;
      this.financialYear = `FY ${fyStart}-${fyStart + 1}`;
    } catch (e) {
      console.warn('Metadata calculation failed:', e.message);
    }
  }
  // With async functions, you don't need to call next()
});

module.exports = mongoose.model('TrainingProposal', TrainingProposalSchema);