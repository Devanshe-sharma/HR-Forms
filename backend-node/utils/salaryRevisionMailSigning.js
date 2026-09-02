const crypto = require('crypto');

// Same convention as utils/interviewConfirmSigning.js — makes the public,
// unauthenticated mail-action links (manager/management filling in their
// decision straight from the email) tamper-resistant. role scopes the
// signature so a manager's link can't be reused to act as management, and
// vice versa.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signSalaryRevisionAction(revisionId, role) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${revisionId}:${role}`).digest('hex');
}

function verifySalaryRevisionAction(revisionId, role, providedSig) {
  if (!SECRET || !revisionId || !role || !providedSig) return false;
  const expected = signSalaryRevisionAction(revisionId, role);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

function buildSalaryRevisionActionLink(revisionId, role) {
  const sig = signSalaryRevisionAction(String(revisionId), role);
  return `${FRONTEND_URL}/salary-revision-action/${revisionId}?role=${role}&sig=${sig}`;
}

module.exports = { signSalaryRevisionAction, verifySalaryRevisionAction, buildSalaryRevisionActionLink };
