// Documents an employee can upload from their own Profile page (Personal
// Documents / Employment Documents tabs). `key` must match what the
// frontend sends as `docType` in POST /api/onboarding/:id/upload-documents,
// and is validated server-side against this same list — see
// routes/onboardingroutes.js. Mirrored on the frontend in pages/Profile.tsx
// since this backend has no shared package with the frontend.
const ONBOARDING_DOCUMENT_TYPES = [
  // Personal Documents
  { key: 'resume', label: 'Resume' },
  { key: 'personalPhoto', label: 'Personal Photograph' },
  { key: 'tenthMarksheet', label: '10th Marksheet' },
  { key: 'twelfthMarksheet', label: '12th Marksheet' },
  { key: 'graduationMarksheet', label: 'Graduation Marksheet' },
  { key: 'pgMarksheet', label: 'Postgraduate Marksheet' },
  { key: 'aadhaarPan', label: 'Aadhaar / PAN Card' },
  // Employment Documents (the rest of that tab — Offer/Appointment/
  // Increment Letters, Payslips — are system-issued via /employee-letters,
  // not self-uploaded, so they have no entry here)
  { key: 'experienceLetter', label: 'Experience Letter' },
];

module.exports = ONBOARDING_DOCUMENT_TYPES;
