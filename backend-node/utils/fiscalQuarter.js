// Indian financial year: Apr 1 – Mar 31. Every "year" param across the HR
// Dashboard's analytics endpoints means the fiscal year's START calendar
// year — year=2026 means FY2026-27 (Apr 2026 – Mar 2027), so Jan–Mar 2027
// belongs to fiscal year 2026, not calendar year 2027. Quarters follow the
// same shift: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar.
const FISCAL_START_MONTH = 3; // April, 0-indexed (Jan=0)

function fiscalYearOf(date) {
  const d = new Date(date);
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= FISCAL_START_MONTH ? y : y - 1;
}

function fiscalQuarterOf(date) {
  const d = new Date(date);
  const shifted = (d.getMonth() - FISCAL_START_MONTH + 12) % 12;
  return Math.floor(shifted / 3) + 1;
}

// Local-time start/end of fiscal quarter `quarter` of fiscal year `year`.
function fiscalQuarterStart(year, quarter) {
  return new Date(year, FISCAL_START_MONTH + (quarter - 1) * 3, 1);
}
function fiscalQuarterEnd(year, quarter) {
  return new Date(year, FISCAL_START_MONTH + quarter * 3, 0, 23, 59, 59);
}

// UTC variants — for the "asOf" timestamps this app already stamps in UTC
// (see onboardingroutes.js's original quarterEndDate).
function fiscalQuarterStartUTC(year, quarter) {
  return new Date(Date.UTC(year, FISCAL_START_MONTH + (quarter - 1) * 3, 1, 0, 0, 0));
}
function fiscalQuarterEndUTC(year, quarter) {
  return new Date(Date.UTC(year, FISCAL_START_MONTH + quarter * 3, 0, 23, 59, 59));
}

// "FY 2026-27" style label for a fiscal year's start-year number.
function fiscalYearLabel(year) {
  return `FY ${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

module.exports = {
  fiscalYearOf,
  fiscalQuarterOf,
  fiscalQuarterStart,
  fiscalQuarterEnd,
  fiscalQuarterStartUTC,
  fiscalQuarterEndUTC,
  fiscalYearLabel,
};
