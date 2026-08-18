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
  'hygieneFactors',
  'confirmations',
  'salaryRevision',
  'employeeLetters',
  'pms',
  'escalations',

  // Sub-page/tab keys — flat strings, no parent/child structure here.
  // The "parentKey.subKey" naming is just for readability.
  'recruitment.dashboard',
  'recruitment.newRequisition',
  'recruitment.candidates',
  'recruitment.referrals',
  'onboarding.dashboard',
  'onboarding.new',
  'onboarding.update',
  'exit.dashboard',
  'exit.new',
  'exit.update',
  'trainings.hr',
  'trainings.manager',
  'trainings.management',
  'trainings.employee',
  'trainings.scorecard',
  'outings.hr',
  'outings.management',
  'outings.view',
  'outings.feedback',
  'outings.scorecard',
  'pms.kpi',
  'pms.hygiene',
  'pms.growth',
  'pms.summary',
  'hygieneFactors.outOfOffice',
  'hygieneFactors.attendance',
  'hygieneFactors.leaves',
]);

const VISIBILITY_ROLES = Object.freeze(['Employee', 'HR', 'Manager']);

module.exports = { PAGE_KEYS, VISIBILITY_ROLES };
