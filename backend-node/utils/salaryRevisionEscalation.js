// Day thresholds for the manager -> management -> HR chain. Specified
// directly by the user on 2026-09-03 (superseding the earlier
// reconciliation of the PDF mockup's conflicting timelines):
//
//   Reminder Date (day 0) -> Mail 1 to manager
//   day 8  -> Mail 5 (Manager Escalation) — a nudge BEFORE the deadline,
//             not after
//   day 10 -> manager's window closes; if still nothing, Mail 6 (Final
//             Escalation, to HR Head)
//   Management then gets its own 10-day window from managerDecision.submittedAt
//   HR then gets its own 10-day window from managementDecision.submittedAt
//
// Every sender/route/the scoring module reads from this single place.

const MANAGER_WINDOW_DAYS = 10;
// Mail 5 fires this many days BEFORE the manager's deadline (day 8 = day
// 10 minus day 2) — a proactive nudge, not a post-deadline scold.
const MANAGER_ESCALATION_LEAD_DAYS = 2;
const MANAGEMENT_WINDOW_DAYS = 10;
const HR_WINDOW_DAYS = 10;
// Measured from the same anchor as MANAGER_WINDOW_DAYS — fires once the
// manager's own window has fully expired with still no decision.
const FINAL_ESCALATION_DAYS = 10;

// Only revisions requested on/after this date are eligible for the
// escalation chain (Mail 5/6). Everything created before this was
// pre-existing test/legacy data never actually being tracked as "in
// process" — escalating a manager or HR Head about a months-old backlog
// they were never told to expect would be confusing, not helpful. Per
// explicit instruction 2026-09-03: only Sep 2026 onwards counts.
const ESCALATION_ELIGIBLE_FROM = new Date(2026, 8, 1);

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = {
  MANAGER_WINDOW_DAYS,
  MANAGER_ESCALATION_LEAD_DAYS,
  MANAGEMENT_WINDOW_DAYS,
  HR_WINDOW_DAYS,
  FINAL_ESCALATION_DAYS,
  ESCALATION_ELIGIBLE_FROM,
  addDays,
};
