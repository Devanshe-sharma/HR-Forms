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
  },
  {
    timestamps: true,
    collection: 'outOfOffice',
  }
);

module.exports = mongoose.model('OutOfOffice', OutOfOfficeSchema);
