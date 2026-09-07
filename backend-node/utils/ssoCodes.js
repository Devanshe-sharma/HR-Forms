/**
 * Single-use, short-lived codes for cross-app SSO (see routes/auth.js
 * `/sso/code` and `/sso/exchange`). A partner app's backend exchanges one
 * of these for the logged-in user's identity — the code itself is
 * worthless without also holding SSO_SERVICE_KEY, so it's fine to pass it
 * through the browser as a query param.
 *
 * In-memory only: this process is the sole source of truth, and codes
 * outlive their 60s TTL by at most a few seconds (cleanup sweep), so a
 * restart losing pending codes just means an SSO redirect has to restart —
 * no user-visible data loss.
 */

const CODE_TTL_MS = 60 * 1000;
const codes = new Map();

function createCode(payload) {
  const code = require('crypto').randomBytes(32).toString('hex');
  codes.set(code, { ...payload, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Consumes (deletes) the code if it's valid, returning its payload — else null. */
function consumeCode(code) {
  const entry = codes.get(code);
  if (!entry) return null;
  codes.delete(code);
  if (entry.expiresAt < Date.now()) return null;
  const { expiresAt, ...payload } = entry;
  return payload;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (entry.expiresAt < now) codes.delete(code);
  }
}, CODE_TTL_MS).unref();

module.exports = { createCode, consumeCode };
