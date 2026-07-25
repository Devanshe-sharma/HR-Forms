const mongoose = require('mongoose');

const candidateApplicationSchema = new mongoose.Schema(
  {
    full_name:             { type: String, required: true, trim: true },
    email:                 { type: String, required: true, trim: true, lowercase: true },
    phone:                 { type: String, required: true },          // dialCode + number
    whatsapp_same:         { type: Boolean, default: false },
    dob:                   { type: String, required: true },

    country:               { type: String, required: true },
    state:                 { type: String, required: true },
    city:                  { type: String, required: true },
    pin_code:              { type: String, required: true },
    relocation:            { type: String, enum: ['Yes', 'No'], required: true },

    // job_id was missing entirely — every submission's job_id value was
    // being silently dropped by Mongoose's default strict schema mode,
    // which is why the JD-lookup-by-job_id logic in the confirmation and
    // HR notification emails has never actually been able to find
    // anything (doc.job_id was always undefined once read back from the
    // database, regardless of what the form actually submitted).
    job_id:                { type: Number },
    designation:           { type: String, required: true },
    designation_id:        { type: Number },

    highest_qualification: { type: String, required: true },

    experience:            { type: String, enum: ['Yes', 'No'], required: true },
    total_experience:      { type: String, default: '' },
    current_ctc:           { type: String, default: '' },
    notice_period:         { type: String, default: '' },
    expected_monthly_ctc:  { type: String, required: true },

    hindi_read:            { type: String, required: true },
    hindi_write:           { type: String, required: true },
    hindi_speak:           { type: String, required: true },
    english_read:          { type: String, required: true },
    english_write:         { type: String, required: true },
    english_speak:         { type: String, required: true },

    facebookLink:          { type: String, default: '' },
    linkedin:              { type: String, default: '' },
    short_video_url:       { type: String, default: '' },

    // Path/URL to the uploaded PDF, set by the upload middleware in
    // routes/candidateApplications.js — never populated directly from
    // req.body (that's just the on-disk path multer wrote it to).
    resume:                { type: String, default: '' },

    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Shortlisted', 'Rejected'],
      default: 'New',
    },

    // AI fit analysis against the matching requisition's JD — populated
    // on demand via POST /api/applicant-records/:id/analyze, not
    // automatically on every save (200+ applications means running this
    // for every single one unprompted would be a real, ongoing API
    // cost — this only runs when someone actually asks for it).
    ai_fit_score:    { type: Number, default: null },   // 1-10
    ai_fit_summary:  { type: String, default: '' },
    ai_analyzed_at:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CandidateApplication', candidateApplicationSchema);