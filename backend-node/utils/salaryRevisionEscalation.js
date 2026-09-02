// Day thresholds for the manager-recommendation escalation chain. The
// source spec (Salary Revision_Mockup.pdf) gives two different timelines
// in different places (30/10 days vs. -3/0/+2/+5) that don't agree with
// each other — these are a reasonable reconciliation, not a verbatim copy
// of either. Adjust here if the business wants different day counts; every
// sender/route reads from this single place.

// How many days a manager is given to submit a recommendation before it's
// considered "due" — shown to the manager in Mail 1, and is the anchor
// Mail 5/6's day counts below are measured from.
const RESPONSE_DAYS = 15;

// Mail 5 — nudge the same reporting manager once this many days have
// passed since the revision entered 'pending_manager' with no decision yet.
const MANAGER_ESCALATION_DAYS = 15;

// Mail 6 — escalate up to a senior manager/department head once this many
// days have passed with still no manager decision.
const FINAL_ESCALATION_DAYS = 25;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = { RESPONSE_DAYS, MANAGER_ESCALATION_DAYS, FINAL_ESCALATION_DAYS, addDays };
