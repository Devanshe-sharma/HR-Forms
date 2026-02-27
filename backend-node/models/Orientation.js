const mongoose = require('mongoose');

// ── Single link entry (used inside arrays) ────────────────────────────────────
const LinkSchema = new mongoose.Schema({
  id:          { type: String, required: true },   // client-side stable id
  name:        { type: String, required: true },   // display name
  url:         { type: String, default: '' },      // Google Drive / external URL
  uploadedBy:  { type: String, default: '' },
  updatedAt:   { type: Date, default: Date.now },
}, { _id: false });

// ── Insurance contact sub-schema ──────────────────────────────────────────────
const ContactSchema = new mongoose.Schema({
  name:  { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
}, { _id: false });

// ── Main orientation document (one doc per company / tenant) ──────────────────
const OrientationSchema = new mongoose.Schema(
  {
    // 1. Onboarding PPT  — single link
    onboardingPPT: {
      name:       { type: String, default: 'Company_Onboarding_2025.pptx' },
      url:        { type: String, default: '' },
      updatedBy:  { type: String, default: '' },
    },

    // 2. Onboarding Test — single link
    onboardingTest: {
      name:       { type: String, default: 'Onboarding_Test_Q&A.pdf' },
      url:        { type: String, default: '' },
      updatedBy:  { type: String, default: '' },
    },

    // 3. Company Policies — array of links
    policies: { type: [LinkSchema], default: [] },

    // 4. Tax & Statutory Forms — array of links
    taxForms: { type: [LinkSchema], default: [] },

    // 5. Holidays — array
    holidays: {
      type: [new mongoose.Schema({
        id:   { type: String, required: true },
        name: { type: String, required: true },
        date: { type: String, required: true },   // display string e.g. "26 Jan 2025"
        type: { type: String, enum: ['national', 'optional'], default: 'national' },
      }, { _id: false })],
      default: [],
    },

    // 6. Week Off rules — array
    weekoffs: {
      type: [new mongoose.Schema({
        id:    { type: String, required: true },
        label: { type: String, required: true },
        days:  { type: String, required: true },
      }, { _id: false })],
      default: [],
    },

    // 7. Medical Insurance
    insurance: {
      policyUrl:       { type: String, default: '' },
      policyName:      { type: String, default: 'Group_Health_Policy_2025.pdf' },
      claimFormUrl:    { type: String, default: '' },
      claimFormName:   { type: String, default: 'Claim_Form.pdf' },
      eCardSteps:      { type: [String], default: ['Visit health.insurer.com', 'Login with Employee ID & DOB', 'Go to "My E-Card"', 'Click Download PDF'] },
      claimSteps:      { type: [String], default: ['Inform HR within 24 hrs', 'Fill Claim Form (attach bills)', 'Submit to HR for verification', 'HR forwards to TPA'] },
      representative:  { type: ContactSchema, default: () => ({}) },
      updatedBy:       { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Orientation', OrientationSchema);