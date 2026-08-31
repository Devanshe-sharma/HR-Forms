// Mirrors the due-date/anchor-date model in frontend/src/pages/
// SalaryRevisionNew.tsx (get11MonthDate / internReviewDate /
// anniversaryDateForYear / computeAnchorDate / isDueInRange) exactly, so
// any email built from this agrees with what the dashboard's Quarter tab
// shows. Don't invent a different date convention here — if the
// dashboard logic changes, port the change to this file too.

function get11MonthDate(joiningDate) {
  const d = new Date(joiningDate);
  return new Date(d.getFullYear(), d.getMonth() + 11, d.getDate());
}

// Intern review/PPO date — joining date + (contract months - 1), the same
// "one month early" convention as get11MonthDate's annual +11.
function internReviewDate(joiningDate, contractMonths) {
  const d = new Date(joiningDate);
  return new Date(d.getFullYear(), d.getMonth() + (contractMonths - 1), d.getDate());
}

function anniversaryDateForYear(joiningDate, year) {
  const first = get11MonthDate(joiningDate);
  return new Date(year, first.getMonth(), first.getDate());
}

// The annual review "clock" doesn't always run from the original joining
// date. Two things reset it:
//   1. A completed revision landing in the currently-expected due month
//      (an on-time annual review) — the next cycle then runs from THAT
//      revision's date, not the original joining date.
//   2. A PPO/intern-to-full-time conversion (fullTimeSince) — this always
//      resets the anchor regardless of timing.
// A revision landing outside the expected month (a mid-term/off-cycle
// adjustment) is skipped — it must NOT push next year's due date.
function computeAnchorDate(joiningDate, revisions) {
  const completed = (revisions || [])
    .filter((r) => r.stage === 'completed')
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let anchor = new Date(joiningDate);

  for (const rev of completed) {
    if (rev.fullTimeSince) {
      anchor = new Date(rev.fullTimeSince);
      continue;
    }

    const revDate = rev.applicableDate ? new Date(rev.applicableDate) : new Date(rev.createdAt);
    const expectedMonth = get11MonthDate(anchor).getMonth();

    if (revDate.getMonth() === expectedMonth) {
      anchor = revDate;
    }
  }

  return anchor;
}

// Does this employee's recurring annual due-date land inside [rangeStart,
// rangeEnd]? Checks every calendar year the range could touch (a fiscal
// quarter never spans more than 2), and confirms the candidate is both
// on/after the employee's very first due date AND inside the window.
// Returns the matching due date, or null.
function isDueInRange(anchor, rangeStart, rangeEnd) {
  const first = get11MonthDate(anchor);
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    const candidate = new Date(y, first.getMonth(), first.getDate());
    if (candidate >= first && candidate >= rangeStart && candidate <= rangeEnd) {
      return candidate;
    }
  }
  return null;
}

// This employee's Due Date occurrence inside [rangeStart, rangeEnd] — null
// if there isn't enough data (no joining date, an intern with no contract
// period on file) or their due-date simply doesn't fall in this window.
function dueDateInRange(employee, revisions, rangeStart, rangeEnd) {
  if (!employee.joiningDate) return null;

  if (employee.employeeCategory === 'Intern') {
    if (!employee.contractPeriod) return null;
    const d = internReviewDate(employee.joiningDate, employee.contractPeriod);
    return (d >= rangeStart && d <= rangeEnd) ? d : null;
  }

  const anchor = computeAnchorDate(employee.joiningDate, revisions);
  return isDueInRange(anchor, rangeStart, rangeEnd);
}

// Done Date is the real anniversary/contract-end — Due Date + 1 month,
// the "-1 month early" convention applies uniformly to employees and
// interns, so shifting Due Date forward always recovers it.
function doneDateFor(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, dueDate.getDate());
}

module.exports = {
  get11MonthDate,
  internReviewDate,
  anniversaryDateForYear,
  computeAnchorDate,
  isDueInRange,
  dueDateInRange,
  doneDateFor,
};
