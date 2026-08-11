const crypto = require('crypto');

// Same convention as utils/accessLinkSigning.js — reuses the same secret
// since both exist to make public, unauthenticated email links tamper-
// resistant. Deliberately refuses to sign/verify if the secret is missing
// rather than falling back to something guessable.
const SECRET = process.env.ACCESS_LINK_SECRET;

// purpose scopes the signature to a specific link type (default 'confirm',
// the candidate's Yes/Maybe/Can't-attend links) — so e.g. a 'feedback' link
// (interviewer feedback form) signed for the same record+round can't be
// reconstructed from a 'confirm' link the candidate already has, and vice
// versa. Each purpose is its own independent signature.
function signInterviewConfirm(recordId, roundId, purpose = 'confirm') {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${recordId}:${roundId}:${purpose}`).digest('hex');
}

function verifyInterviewConfirm(recordId, roundId, providedSig, purpose = 'confirm') {
  if (!SECRET || !recordId || !roundId || !providedSig) return false;
  const expected = signInterviewConfirm(recordId, roundId, purpose);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signInterviewConfirm, verifyInterviewConfirm };
