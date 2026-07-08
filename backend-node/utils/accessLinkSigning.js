const crypto = require("crypto");

// Secret used to sign access links. MUST be set in .env — if it's ever
// missing, we deliberately refuse to sign/verify anything rather than
// silently falling back to a guessable default.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signEmail(email) {
  if (!SECRET) throw new Error("ACCESS_LINK_SECRET is not set in .env");
  const normalized = (email || "").trim().toLowerCase();
  return crypto.createHmac("sha256", SECRET).update(normalized).digest("hex");
}

// Constant-time comparison — avoids leaking timing information about how
// much of the signature matched, which a naive === check would.
function verifySignature(email, providedSig) {
  if (!SECRET || !email || !providedSig) return false;
  const expected = signEmail(email);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(providedSig), "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signEmail, verifySignature };