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

    status: {
      type: String,
      enum: ['New', 'Reviewed', 'Shortlisted', 'Rejected'],
      default: 'New',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CandidateApplication', candidateApplicationSchema);