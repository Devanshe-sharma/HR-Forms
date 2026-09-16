// Day-count constants for the Confirmation mail-reminder chain — single
// source of truth, same convention as utils/salaryRevisionEscalation.js.
// Both reminders are measured from when the PRECEDING mail in the chain
// was queued (managerRequestedAt / managementRequestedAt), not from the
// review date itself — confirmed with the user 2026-09-16.
const MANAGER_REMINDER_DAYS    = 10; // after Mail 1 (Manager Request)
const MANAGEMENT_REMINDER_DAYS = 10; // after Mail 2 (Management Request)

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = { MANAGER_REMINDER_DAYS, MANAGEMENT_REMINDER_DAYS, addDays };
