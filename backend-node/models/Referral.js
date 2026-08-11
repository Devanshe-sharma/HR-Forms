const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    requisitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'HiringRequisition', required: true },
    // Snapshotted at referral time so the dashboard list doesn't need to
    // populate the requisition on every load, and stays meaningful even
    // if the requisition's own fields change later.
    serial_no:   { type: Number, default: null },
    designation: { type: String, default: '' },
    hiring_dept: { type: String, default: '' },

    referrerName:  { type: String, required: true, trim: true },
    referrerEmail: { type: String, required: true, trim: true, lowercase: true },

    candidateName:  { type: String, required: true, trim: true },
    candidatePhone: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true },

    // Optional context for HR — e.g. "former colleague", "friend",
    // "relative" — surfaces potential conflicts of interest up front.
    relationship: { type: String, default: '' },

    // Drive link, same as CandidateApplication.resume — set by the
    // upload middleware in routes/referrals.js.
    resume: { type: String, default: '' },

    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Contacted', 'Converted', 'Rejected'],
      default: 'New',
    },

    // Set once HR promotes this referral into the real candidate
    // pipeline via PATCH /:id/convert.
    convertedApplicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateApplication', default: null },
  },
  { timestamps: true }
);

// Same person referred twice for the same role is a data-quality problem,
// not a legitimate second referral — enforced here so it holds even
// against a direct API call, mirroring CandidateApplication's own
// {email, job_id} unique index.
referralSchema.index({ candidateEmail: 1, requisitionId: 1 }, { unique: true });
referralSchema.index({ requisitionId: 1 });
referralSchema.index({ status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
