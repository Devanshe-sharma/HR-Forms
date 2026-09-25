const jwt = require('jsonwebtoken');
const User = require('../models/User');

function readToken(req) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function verify(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { id: payload.id, email: payload.email, role: payload.role, name: payload.name, tokenVersion: payload.tokenVersion || 0 };
  } catch {
    return null;
  }
}

// A signature-valid, unexpired JWT can still have been deliberately
// invalidated (POST /api/auth/force-logout-all) — that bumps the user's
// tokenVersion in the DB, so any token minted before the bump now carries a
// stale value. This is the one DB round-trip in the request path that makes
// that revocation actually take effect before the token's own expiry.
async function tokenVersionMatches(payload) {
  const user = await User.findById(payload.id).select('tokenVersion').lean();
  if (!user) return false;
  return (user.tokenVersion || 0) === payload.tokenVersion;
}

/** Require a valid JWT. Sets req.user, else 401. */
async function authenticate(req, res, next) {
  // The global `app.use('/api', attachUser)` already ran this same check
  // for every /api request — if it already populated req.user, the token
  // is known-good and there's no need to hit the DB a second time here.
  if (req.user) return next();

  const user = verify(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    if (!(await tokenVersionMatches(user))) {
      return res.status(401).json({ success: false, error: 'Session expired — please log in again' });
    }
  } catch (err) {
    return next(err);
  }
  req.user = user;
  next();
}

/** Attach req.user if a valid JWT is present, otherwise continue unauthenticated. */
async function attachUser(req, res, next) {
  const user = verify(req);
  if (user) {
    try {
      if (await tokenVersionMatches(user)) req.user = user;
    } catch {
      // best-effort — leave req.user unset rather than fail an
      // unauthenticated-friendly route over this check
    }
  }
  next();
}

module.exports = { authenticate, attachUser };
