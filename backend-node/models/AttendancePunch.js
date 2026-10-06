const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// One row per punch (in or out) — the raw event as reported by the
// external attendance/biometric system, not a pre-computed daily summary.
// "First punch of the day = in, last punch of the day = out" is derived at
// read time (see routes/attendance.js), not stored here, since a device
// can report more than 2 punches a day (breaks, re-entries) and collapsing
// that at write time would throw away real information.
const AttendancePunchSchema = new Schema(
  {
    // Whatever identifier the external system sends for this employee.
    // Ideally the vendor's device/portal is configured to use the same
    // empId Onboarding already uses (models/onboardingModel.js), but this
    // is stored verbatim either way so nothing is silently dropped if it
    // doesn't line up yet.
    employeeCode: { type: String, required: true, trim: true, index: true },

    // Name as the machine/vendor reports it (employee_name), shown on the
    // Attendance tab since the machine code can't be matched to an empId.
    employeeName: { type: String, trim: true, default: '' },

    // Best-effort link to the actual employee record, resolved at
    // ingestion time by matching employeeCode against Onboarding.empId.
    // Null if no match was found — the raw employeeCode is always kept
    // regardless, so records can be re-matched later (e.g. after fixing a
    // code mismatch) without re-ingesting anything.
    onboardingId: { type: Schema.Types.ObjectId, ref: 'Onboarding', default: null, index: true },

    // When the punch actually happened, per the device — not when it
    // reached us (see receivedAt below for that).
    timestamp: { type: Date, required: true, index: true },

    // 'in' | 'out' | '' — many devices report this explicitly; if a given
    // payload doesn't include a direction, this is left blank and in/out
    // gets derived from ordering within the day at read time instead of
    // guessed here.
    direction: { type: String, enum: ['in', 'out', ''], default: '' },

    deviceId: { type: String, trim: true, default: '' },

    // The exact payload as received, untouched — lets a mapping bug be
    // diagnosed or re-processed later without having lost any information
    // the vendor actually sent.
    raw: { type: Schema.Types.Mixed, default: null },

    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'attendance_punches' }
);

AttendancePunchSchema.index({ employeeCode: 1, timestamp: 1 });

module.exports = mongoose.model('AttendancePunch', AttendancePunchSchema);
