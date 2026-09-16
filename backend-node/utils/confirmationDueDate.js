// Date math shared by the Confirmation mail senders/templates — a
// standalone copy of the same addMonths logic routes/confirmations.js
// uses internally (kept separate rather than imported, matching the
// existing convention of mail code owning its own date math — see
// salaryRevisionDueDate.js for the same pattern on Salary Revision).
function addMonths(date, months) {
  const d = new Date(date);
  d.setDate(1); // avoid month-boundary skew (e.g. Jan 31 + 1 month)
  d.setMonth(d.getMonth() + months);
  d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  return d;
}

// Standard probation length this whole module assumes — matches the
// 5-months'-tenure auto-open trigger in advanceStageIfDue() (i.e. the
// review opens exactly 1 month before this date).
const STANDARD_PROBATION_MONTHS = 6;

function expectedConfirmationDate(joiningDate) {
  return addMonths(joiningDate, STANDARD_PROBATION_MONTHS);
}

// Human-readable label for a currentStatus/decision status value, used
// across every Confirmation mail template.
const STATUS_LABEL = {
  probation: 'Continue Probation',
  confirmed: 'Confirmed',
  extended: 'Extended Probation',
  not_confirmed: 'Not Confirmed',
};

module.exports = { addMonths, STANDARD_PROBATION_MONTHS, expectedConfirmationDate, STATUS_LABEL };
