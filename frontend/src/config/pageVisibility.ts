/**
 * Canonical list of configurable sidebar/page keys for per-role page
 * visibility (Employee / HR / Manager). Keep in sync with the PAGE_KEYS
 * list in backend-node/config/pages.js. `paths` lists every route this
 * page covers, taken from Sidebar.tsx's menuItems / App.tsx's routes.
 *
 * Profile and Configuration are intentionally NOT here — they always stay
 * visible for every role (Configuration is where a locked-out role would
 * otherwise need to go to fix its own access).
 *
 * Some pages have `subPages` (sidebar sub-items/tabs) — a sub-page is
 * only effectively visible when BOTH its parent page and the sub-page
 * itself are visible for that role.
 */

export interface SubPageDef {
  key: string;
  label: string;
  /** Exact pathname, optionally with a query string, e.g. '/training-page?tab=manager'. */
  path: string;
}

export interface PageDef {
  key: string;
  label: string;
  paths: string[];
  subPages?: SubPageDef[];
}

export const PAGES: PageDef[] = [
  { key: 'companyOrientation', label: 'Company Orientation', paths: ['/company-orientation'] },
  { key: 'deptOrientation', label: 'Department Orientation', paths: ['/dept-orientation'] },
  { key: 'dashboard', label: 'Dashboard', paths: ['/hr-dashboard'] },
  { key: 'employees', label: 'Employees List', paths: ['/employees'] },
  {
    key: 'recruitment',
    label: 'Recruitment',
    paths: ['/recruitment', '/new-hiring-requisition', '/applicants', '/referrals'],
    subPages: [
      { key: 'recruitment.dashboard', label: 'Recruitment Dashboard', path: '/recruitment' },
      { key: 'recruitment.newRequisition', label: 'New Requisition', path: '/new-hiring-requisition' },
      { key: 'recruitment.candidates', label: 'Candidate Management', path: '/applicants' },
      { key: 'recruitment.referrals', label: 'Referrals', path: '/referrals' },
    ],
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    paths: ['/onboarding', '/new-onboarding'],
    subPages: [
      { key: 'onboarding.dashboard', label: 'Onboarding Dashboard', path: '/onboarding/dashboard' },
      { key: 'onboarding.new', label: 'New Onboarding', path: '/new-onboarding' },
      { key: 'onboarding.update', label: 'Update Onboarding', path: '/onboarding/update' },
    ],
  },
  {
    key: 'exit',
    label: 'Exit',
    paths: ['/exits', '/new-exit'],
    subPages: [
      { key: 'exit.dashboard', label: 'Exit Dashboard', path: '/exits' },
      { key: 'exit.new', label: 'New Exit', path: '/new-exit' },
      { key: 'exit.update', label: 'Update Exit', path: '/exits/update' },
    ],
  },
  { key: 'deptDesignationMaster', label: 'Dept & Designation Master', paths: ['/dept-designation-master'] },
  {
    key: 'trainings',
    label: 'Trainings',
    paths: ['/training-page'],
    subPages: [
      { key: 'trainings.hr', label: 'HR', path: '/training-page?tab=HR' },
      { key: 'trainings.manager', label: 'Managers', path: '/training-page?tab=manager' },
      { key: 'trainings.management', label: 'Management', path: '/training-page?tab=management' },
      { key: 'trainings.employee', label: 'Employee', path: '/training-page?tab=employee' },
      { key: 'trainings.scorecard', label: 'Scorecard', path: '/training-page?tab=scorecard' },
    ],
  },
  {
    key: 'outings',
    label: 'Outings / Events',
    paths: ['/outing'],
    subPages: [
      { key: 'outings.hr', label: 'HR Outing', path: '/outing?tab=HR' },
      { key: 'outings.management', label: 'Management Approvals', path: '/outing?tab=management' },
      { key: 'outings.view', label: 'Scheduled & Completed', path: '/outing?tab=outings-view' },
      { key: 'outings.feedback', label: 'Employee Feedback', path: '/outing?tab=employee-feedback' },
      { key: 'outings.scorecard', label: 'Outing Scorecard', path: '/outing?tab=scorecard' },
    ],
  },
  {
    key: 'hygieneFactors',
    label: 'Hygiene Factors',
    paths: ['/attendance'],
    subPages: [
      { key: 'hygieneFactors.outOfOffice', label: 'Out of Office', path: '/attendance?tab=out-of-office' },
      { key: 'hygieneFactors.attendance', label: 'Attendance', path: '/attendance?tab=attendance' },
      { key: 'hygieneFactors.leaves', label: 'Leaves', path: '/attendance?tab=leaves' },
    ],
  },
  { key: 'confirmations', label: 'Confirmations', paths: ['/confirmations'] },
  { key: 'salaryRevision', label: 'Salary Revision', paths: ['/salary-revision'] },
  { key: 'employeeLetters', label: 'Employee Letters', paths: ['/employee-letters'] },
  {
    key: 'pms',
    label: 'PMS',
    paths: ['/pms'],
    subPages: [
      { key: 'pms.kpi', label: 'KPI & Targets', path: '/pms?tab=kpi' },
      { key: 'pms.hygiene', label: 'Hygiene Factors', path: '/pms?tab=hygiene' },
      { key: 'pms.growth', label: 'Growth', path: '/pms?tab=growth' },
      { key: 'pms.summary', label: 'Final Performance', path: '/pms?tab=summary' },
    ],
  },
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

/**
 * Finds the parent page (and, if applicable, the specific sub-page) that
 * governs a given location. `search` should include the leading '?' (as
 * returned by useLocation().search), or be '' if there is none.
 */
export function matchLocation(
  pathname: string,
  search: string
): { pageKey: string; subPageKey: string | null } | null {
  for (const page of PAGES) {
    if (!page.paths.some((p) => pathMatches(pathname, p))) continue;

    let subPageKey: string | null = null;
    if (page.subPages) {
      const full = pathname + (search || '');
      const sub = page.subPages.find((sp) => sp.path === full || sp.path === pathname);
      if (sub) subPageKey = sub.key;
    }
    return { pageKey: page.key, subPageKey };
  }
  return null;
}
