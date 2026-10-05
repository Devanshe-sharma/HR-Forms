const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Singleton settings document (always queried with no filter + upsert) —
// same "one config row" idea as other org-wide settings in this codebase.
// workingDays uses JS Date#getDay() numbering: 0=Sun .. 6=Sat.
const WorkingScheduleSchema = new Schema(
  {
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Mon-Fri
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkingSchedule', WorkingScheduleSchema);
