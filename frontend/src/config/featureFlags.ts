// Deliberately-staged rollouts — built and wired up, switched on later by
// flipping the value here (not tied to any env var, since this is a one-line
// literal changed by hand right before the rollout it belongs to, alongside
// calling POST /api/auth/force-logout-all so every current session picks up
// the gate on its next login rather than being bounced mid-session).

// Blocks ProtectedRoute access to everything except /profile until the
// account's required Personal Details / Emergency Contact & Family fields
// are filled in (see utils/profileCompletion.ts). Off by default so rolling
// this build out doesn't immediately redirect anyone already using the app.
// TEMP: flipped on for local testing only — flip back to false before this
// is committed/deployed anywhere shared.
export const PROFILE_GATE_ENABLED = true;
