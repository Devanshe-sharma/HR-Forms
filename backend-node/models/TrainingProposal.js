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
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Scheduled'],
      default: 'Pending',
    },
    date: {
      type: String, // or Date if you want real date objects later
      default: '',
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // if you have authentication later
      required: false,
    },
  },
  {
    timestamps: true,           // adds createdAt + updatedAt automatically
    collection: 'TrainingProposal',
  }
);

module.exports = mongoose.model('TrainingProposal', TrainingProposalSchema);