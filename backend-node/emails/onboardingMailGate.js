// Single source of truth for every Onboarding email gate — the new-record
// trigger (triggers/triggerNewOnboarding.js), the contract-extension
// notice, and the manual test-reminder-and-feedback route in
// routes/onboardingroutes.js all check this same flag, so there's exactly
// one place to flip Onboarding mail back on.
//
// Re-enabled 2026-09-18 per explicit "start onboarding, exit and
// confirmation mails" instruction (paused 2026-09-17 alongside those).
const ONBOARDING_EMAILS_TEMPORARILY_DISABLED = false;

module.exports = { ONBOARDING_EMAILS_TEMPORARILY_DISABLED };
