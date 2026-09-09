const crypto = require('crypto');

// Same convention as utils/interviewConfirmSigning.js — makes the public,
// unauthenticated candidate document-upload link tamper-resistant. Not
// time-limited; "done" is tracked by the record's own uploadedDocuments
// state, not by the link expiring, so a candidate can revisit it to add
// documents across multiple sessions.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signCandidateUpload(recordId) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${recordId}:upload`).digest('hex');
}

function verifyCandidateUpload(recordId, providedSig) {
  if (!SECRET || !recordId || !providedSig) return false;
  const expected = signCandidateUpload(recordId);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signCandidateUpload, verifyCandidateUpload };
