/**
 * Gates the SSO code-exchange endpoint, which is called server-to-server by
 * a partner app's backend (e.g. renewals-warranties) — never by a browser —
 * so it can't use the normal user JWT. Same pattern as apiKeyAuth.js.
 */
function requireSsoServiceKey(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!key || key !== process.env.SSO_SERVICE_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing service key' });
  }
  next();
}

module.exports = { requireSsoServiceKey };
