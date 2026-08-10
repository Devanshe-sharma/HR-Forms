/**
 * Canonical list of configurable sidebar/page keys for per-role page
 * visibility (Employee / HR / Manager). Keep in sync with the PAGE_KEYS
 * list in backend-node/config/pages.js. `paths` lists every route this
 * page covers, taken from Sidebar.tsx's menuItems / App.tsx's routes.
 *
 * Profile and Configuration are intentionally NOT here — they always stay
 * visible for every role (Configuration is where a locked-out role would
 * otherwise need to go to fix its own access).
 */

export interface PageDef {
  key: string;
  label: string;
  paths: string[];
}

export const PAGES: PageDef[] = [
  { key: 'companyOrientation', label: 'Company Orientation', paths: ['/company-orientation'] },
  { key: 'deptOrientation', label: 'Department Orientation', paths: ['/dept-orientation'] },
  { key: 'dashboard', label: 'Dashboard', paths: ['/hr-dashboard'] },
  { key: 'employees', label: 'Employees List', paths: ['/employees'] },
  {
    key: 'recruitment',
    label: 'Recruitment',
    paths: ['/recruitment', '/new-hiring-requisition', '/applicants'],
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    paths: ['/onboarding', '/new-onboarding'],
  },
  {
    key: 'exit',
    label: 'Exit',
    paths: ['/exits', '/new-exit'],
  },
  { key: 'deptDesignationMaster', label: 'Dept & Designation Master', paths: ['/dept-designation-master'] },
  { key: 'trainings', label: 'Trainings', paths: ['/training-page'] },
  { key: 'outings', label: 'Outings / Events', paths: ['/outing'] },
  { key: 'confirmations', label: 'Confirmations', paths: ['/confirmations'] },
  { key: 'salaryRevision', label: 'Salary Revision', paths: ['/salary-revision'] },
  { key: 'employeeLetters', label: 'Employee Letters', paths: ['/employee-letters'] },
  { key: 'pms', label: 'PMS', paths: ['/pms'] },
];

export const VISIBILITY_ROLES = ['Employee', 'HR', 'Manager'] as const;
export type VisibilityRole = (typeof VISIBILITY_ROLES)[number];

function pathMatches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Finds the page key that governs a given pathname, if any. */
export function matchPageKeyForPath(pathname: string): string | null {
  for (const page of PAGES) {
    if (page.paths.some((p) => pathMatches(pathname, p))) {
      return page.key;
    }
  }
  return null;
}
