const crypto = require('crypto');

// Same convention as utils/salaryRevisionMailSigning.js — makes the public,
// unauthenticated mail-action link (manager approving/rejecting straight
// from the email) tamper-resistant. Only one role exists here (manager), so
// unlike the salary revision version there's no role to scope the signature to.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signOutOfOfficeAction(recordId) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${recordId}:manager`).digest('hex');
}

function verifyOutOfOfficeAction(recordId, providedSig) {
  if (!SECRET || !recordId || !providedSig) return false;
  const expected = signOutOfOfficeAction(recordId);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

function buildOutOfOfficeActionLink(recordId) {
  const sig = signOutOfOfficeAction(String(recordId));
  return `${FRONTEND_URL}/out-of-office-action/${recordId}?sig=${sig}`;
}

module.exports = { signOutOfOfficeAction, verifyOutOfOfficeAction, buildOutOfOfficeActionLink };
