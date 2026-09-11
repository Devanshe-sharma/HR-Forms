// Documents an employee can upload from their own Profile page (Financial &
// Documents tab). `key` must match what the frontend sends as `docType` in
// POST /api/employees/:id/upload-documents, and is validated server-side
// against this same list — see routes/employees.js. Mirrored on the
// frontend in pages/Profile.tsx since this backend has no shared package
// with the frontend.
const EMPLOYEE_DOCUMENT_TYPES = [
  { key: 'tenthMarksheet', label: '10th Marksheet' },
  { key: 'twelfthMarksheet', label: '12th Marksheet' },
  { key: 'graduationMarksheet', label: 'Graduation Marksheet' },
  { key: 'pgMarksheet', label: 'Postgraduate Marksheet' },
  { key: 'aadhaarPan', label: 'Aadhaar / PAN Card' },
  { key: 'experienceLetter', label: 'Experience Letter' },
];

module.exports = EMPLOYEE_DOCUMENT_TYPES;
