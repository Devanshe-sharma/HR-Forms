const crypto = require('crypto');

// Same convention as utils/accessLinkSigning.js — reuses the same secret
// since both exist to make public, unauthenticated email links tamper-
// resistant. Deliberately refuses to sign/verify if the secret is missing
// rather than falling back to something guessable.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signInterviewConfirm(recordId, roundId) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${recordId}:${roundId}`).digest('hex');
}

function verifyInterviewConfirm(recordId, roundId, providedSig) {
  if (!SECRET || !recordId || !roundId || !providedSig) return false;
  const expected = signInterviewConfirm(recordId, roundId);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signInterviewConfirm, verifyInterviewConfirm };
