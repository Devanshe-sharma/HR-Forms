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

    // Only asked/set when informedStatus isn't 'advance' (see
    // routes/outOfOffice.js). 'Planned' auto-raises a Timeliness escalation
    // against the person; 'Not Planned' just records why it was late and
    // when the filer found out, no escalation.
    plannedStatus: { type: String, enum: ['', 'Planned', 'Not Planned'], default: '' },
    lateReason: { type: String, trim: true, default: '' },
    unplannedKnownAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'outOfOffice',
  }
);

module.exports = mongoose.model('OutOfOffice', OutOfOfficeSchema);
