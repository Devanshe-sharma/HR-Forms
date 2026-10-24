// Adjusts the running "escalationScore" conduct tally on Onboarding
// records. Pulled out of routes/escalations.js and routes/outOfOffice.js
// because both call the exact same $inc pattern, and both were vulnerable
// to the same failure: a transient Mongo connection hiccup (observed
// happening intermittently against this cluster) would make the $inc
// silently never apply — invisible for the fire-and-forget OOO path, and
// for the main escalation form, it would fail the whole create/edit/delete
// request even though the Escalation document itself had already saved
// successfully, leading to confused resubmits (e.g. ESC-0023/ESC-0024,
// filed a minute apart against the same person after the first attempt
// appeared to fail).
//
// Retries once after a short delay, then gives up and just logs — the
// score is a secondary conduct tally, not worth failing the whole request
// over, and a human can always correct it by hand if both attempts fail.
const Onboarding = require('../models/onboardingModel');

const RETRY_DELAY_MS = 1500;

async function applyScoreDelta(employeeIds, delta) {
  if (!employeeIds || !employeeIds.length) return;
  await Onboarding.updateMany(
    { _id: { $in: employeeIds } },
    { $inc: { escalationScore: delta } }
  );
}

// Fire-and-forget by design — callers should NOT await this if they want
// a transient DB hiccup to never block/fail their own response. Still
// returns a Promise (resolved once done, including after a retry) for
// callers that DO want to await it (e.g. a script, or a flow where the
// ordering genuinely matters).
async function adjustEscalationScore(employeeIds, delta) {
  try {
    await applyScoreDelta(employeeIds, delta);
  } catch (err) {
    console.error(`[escalationScore] update failed (attempt 1), retrying in ${RETRY_DELAY_MS}ms:`, err.message);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      await applyScoreDelta(employeeIds, delta);
    } catch (err2) {
      console.error('[escalationScore] update failed (attempt 2, giving up):', err2.message,
        '— affected employeeIds:', employeeIds, 'delta:', delta);
    }
  }
}

module.exports = { adjustEscalationScore };
