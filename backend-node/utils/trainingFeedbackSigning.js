const crypto = require('crypto');

// Same convention as utils/candidateUploadSigning.js — makes the public,
// login-free training-feedback link tamper-resistant, so only people who were
// sent the link for a given training can open its form. Not time-limited:
// when feedback is open is decided by the training's own feedback window.
const SECRET = process.env.ACCESS_LINK_SECRET;

function signTrainingFeedback(trainingMongoId) {
  if (!SECRET) throw new Error('ACCESS_LINK_SECRET is not set in .env');
  return crypto.createHmac('sha256', SECRET).update(`${trainingMongoId}:training-feedback`).digest('hex');
}

function verifyTrainingFeedback(trainingMongoId, providedSig) {
  if (!SECRET || !trainingMongoId || !providedSig) return false;
  const expected = signTrainingFeedback(trainingMongoId);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(providedSig), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signTrainingFeedback, verifyTrainingFeedback };
