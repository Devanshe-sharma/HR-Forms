// Single source of truth for every Onboarding email gate — the new-record
// trigger (triggers/triggerNewOnboarding.js), the contract-extension
// notice, and the manual test-reminder-and-feedback route in
// routes/onboardingroutes.js all check this same flag, so there's exactly
// one place to flip Onboarding mail back on.
//
// Paused 2026-09-17 per "stop all onboarding, exit, salary revision,
// confirmation mails".
const ONBOARDING_EMAILS_TEMPORARILY_DISABLED = true;

module.exports = { ONBOARDING_EMAILS_TEMPORARILY_DISABLED };
