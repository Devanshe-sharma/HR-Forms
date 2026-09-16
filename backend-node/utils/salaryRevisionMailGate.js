// Kill switch for the Salary Revision mails that fire SYNCHRONOUSLY from
// inside POST/PUT route handlers (Mail 1 manager request, Mail 2
// management approval, Mail 3 PIP hold / HR notify, Mail 4 employee
// confirmation) — these have no relationship to the scheduler.js cron
// jobs (quarterly digest / auto-trigger / escalation), which are paused
// independently there. Before this file existed, these route-triggered
// sends had no pause switch at all.
//
// Defaults OFF (mail-safe) — set SALARY_REVISION_MAILS_ENABLED=true in
// .env once ready to let these actually send again.
const SALARY_REVISION_MAILS_ENABLED = process.env.SALARY_REVISION_MAILS_ENABLED === 'true';

// Fire-and-forget, same convention as every call site already used
// (mail failure must never fail the request that triggered it) — this
// just adds the enabled-check in front of that.
function sendIfEnabled(sendFn, revision, label) {
  if (!SALARY_REVISION_MAILS_ENABLED) {
    console.log(`[salary-revisions] Mail skipped (SALARY_REVISION_MAILS_ENABLED is not "true"): ${label}`);
    return;
  }
  sendFn(revision).catch((e) => console.error(`[salary-revisions] ${label} mail failed:`, e.message));
}

module.exports = { SALARY_REVISION_MAILS_ENABLED, sendIfEnabled };
