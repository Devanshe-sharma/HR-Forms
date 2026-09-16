const crypto = require('crypto');

// Same convention as utils/salaryRevisionMailSigning.js — makes the
// public, unauthenticated mail-action links (manager/management filling
// in their decision straight from the email) tamper-resistant. role
// scopes the signature so a manager's link can't be reused to act as
// management, and vice versa.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signConfirmationAction(confirmationId, role) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${confirmationId}:${role}`).digest('hex');
}

function verifyConfirmationAction(confirmationId, role, providedSig) {
  if (!SECRET || !confirmationId || !role || !providedSig) return false;
  const expected = signConfirmationAction(confirmationId, role);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

function buildConfirmationActionLink(confirmationId, role) {
  const sig = signConfirmationAction(String(confirmationId), role);
  return `${FRONTEND_URL}/confirmation-action/${confirmationId}?role=${role}&sig=${sig}`;
}

module.exports = { signConfirmationAction, verifyConfirmationAction, buildConfirmationActionLink };
