const jwt = require('jsonwebtoken');

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
    return { id: payload.id, email: payload.email, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

/** Require a valid JWT. Sets req.user, else 401. */
function authenticate(req, res, next) {
  const user = verify(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  req.user = user;
  next();
}

/** Attach req.user if a valid JWT is present, otherwise continue unauthenticated. */
function attachUser(req, res, next) {
  const user = verify(req);
  if (user) req.user = user;
  next();
}

module.exports = { authenticate, attachUser };
