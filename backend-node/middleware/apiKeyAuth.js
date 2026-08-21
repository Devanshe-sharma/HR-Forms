/**
 * Gates external/machine-to-machine API routes with a static key, since
 * these callers (Zapier, Sheets, another server) have no login session or
 * JWT the way this app's own frontend does.
 */
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.EXTERNAL_EMPLOYEES_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
}

module.exports = { requireApiKey };
