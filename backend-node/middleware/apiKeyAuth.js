/**
 * Gates external/machine-to-machine API routes with a static key, since
 * these callers (Zapier, Sheets, another server) have no login session or
 * JWT the way this app's own frontend does.
 *
 * Each external route gets its own env-var-backed key (rather than one key
 * shared across every scope) so a leaked/rotated key for one integration
 * doesn't affect the others. Defaults to EXTERNAL_EMPLOYEES_API_KEY to keep
 * the original /api/external/employees call site working unchanged.
 */
function requireApiKey(envVarName = 'EXTERNAL_EMPLOYEES_API_KEY') {
  return (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (!key || key !== process.env[envVarName]) {
      return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
    }
    next();
  };
}

module.exports = { requireApiKey };
