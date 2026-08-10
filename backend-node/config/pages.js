/**
 * Canonical list of configurable sidebar/page keys for per-role page
 * visibility (Employee / HR / Manager). Keep in sync with the PAGES list
 * in frontend/src/config/pageVisibility.ts.
 */

const PAGE_KEYS = Object.freeze([
  'companyOrientation',
  'deptOrientation',
  'dashboard',
  'employees',
  'recruitment',
  'onboarding',
  'exit',
  'deptDesignationMaster',
  'trainings',
  'outings',
  'confirmations',
  'salaryRevision',
  'employeeLetters',
  'pms',
]);

const VISIBILITY_ROLES = Object.freeze(['Employee', 'HR', 'Manager']);

module.exports = { PAGE_KEYS, VISIBILITY_ROLES };
