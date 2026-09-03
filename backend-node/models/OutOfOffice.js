const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OutOfOfficeSchema = new Schema(
  {
    submittedByEmail: { type: String, trim: true, default: '' },
    submittedByName: { type: String, trim: true, default: '' },

    person: {
      employeeId: { type: Schema.Types.ObjectId, ref: 'Onboarding' },
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
    },

    startDateTime: { type: Date, required: true },
    // Optional — omitted means "same day as startDateTime" (single-day OOO).
    // Kept separate from upToTime (rather than one combined Date) so existing
    // records that only ever stored a time-of-day keep working unchanged.
    upToDate: { type: String, trim: true, default: '' },
    upToTime: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },

    ccEmployees: [
      {
        employeeId: { type: Schema.Types.ObjectId, ref: 'Onboarding' },
        name: String,
        email: { type: String, trim: true, lowercase: true },
      },
    ],

    informedStatus: {
      type: String,
      enum: ['advance', 'late_before_start', 'late_after_start'],
      required: true,
    },
    informedLabel: { type: String, trim: true, default: '' },

    // Snapshot of the reporting manager resolved at submission time (same
    // Onboarding.reviewerName/reviewerEmail lookup Salary Revision uses) —
    // kept on the record so the mail-action link and dashboard don't depend
    // on the org chart staying the same after the request was sent.
    manager: {
      name: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
    },

    approval: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      reason: { type: String, trim: true, default: '' },
      decidedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
    collection: 'outOfOffice',
  }
);

module.exports = mongoose.model('OutOfOffice', OutOfOfficeSchema);
