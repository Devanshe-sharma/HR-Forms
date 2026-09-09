// Documents requested in the Offer Letter email's "List of Documents
// required" section — key must match the multer field name used by
// POST /:id/upload-documents in routes/applicantRecords.js, and mirrored
// on the frontend (CandidateDocumentUpload.tsx, applicantTypes.ts) since
// this backend has no shared package with the frontend.
const REQUIRED_CANDIDATE_DOCUMENTS = [
  { key: 'resume', label: 'Resume' },
  { key: 'photos', label: '2 Passport Size Colour Photographs' },
  { key: 'panOrVoterId', label: 'A Copy of PAN Card / Voter ID Card' },
  { key: 'aadhar', label: 'A Copy of Aadhar Card' },
  { key: 'bankDetails', label: 'A Copy of Bank Details' },
  { key: 'uan', label: 'A Copy of UAN Number, if Applicable' },
  { key: 'educationCertificates', label: 'A Copy of Education Certificates - 10th, 12th, Graduation, Post Graduation' },
  { key: 'previousCompanyDocs', label: "A Copy of Previous Company Details - Experience Letter, Last 3 Months' Salary Slips, if Applicable" },
];

module.exports = REQUIRED_CANDIDATE_DOCUMENTS;
