/**
 * Centralized RBAC for frontend. Never hardcode role checks in components.
 * Map localStorage "role" to internal role and use can() / hasRole().
 */

export const ROLES = [
  'Admin',
  'HR',
  'HeadOfDepartment',
  'Manager',
  'Trainer',
  'Employee',
  'Management',
] as const;

export type Role = (typeof ROLES)[number];

/** Map legacy localStorage role values to RBAC role */
const LEGACY_ROLE_MAP: Record<string, Role> = {
  'HR Department':           'HR',
  'DAA Department':          'Admin',
  'Employees and outsiders': 'Employee',
  Admin:            'Admin',
  HR:               'HR',
  HeadOfDepartment: 'HeadOfDepartment',
  Manager:          'Manager',
  Trainer:          'Trainer',
  Employee:         'Employee',
  Management:       'Management',
};

const ROLE_PERMISSIONS: Record<Role, Record<string, string[]>> = {

  // ── Admin ── full access everywhere
  Admin: {
    capability:           ['create', 'read', 'update', 'delete'],
    training:             ['create', 'read', 'update', 'delete'],
    capabilities:         ['create', 'read', 'update', 'delete'],
    capabilityAssessment: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],  // manager evaluations
    trainingSuggestions:  ['create', 'read', 'update', 'delete'],
    trainingSchedule:     ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    trainingMaterials:    ['create', 'read', 'update', 'delete'],
    trainingFeedback:     ['create', 'read'],
    employeeScores:       ['read'],
    managementPending:    ['read', 'approve', 'reject'],
    skillGap:             ['read'],  // company-wide
  },

  // ── HR ── manages capability setup, topics, scheduling
  HR: {
    capability:           ['create', 'read', 'update', 'delete'],
    training:             ['create', 'read', 'update', 'delete'],
    capabilities:         ['create', 'read', 'update', 'delete'],
    capabilityAssessment: [],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: ['read'],   // HR can view evaluations but not submit them
    trainingSuggestions:  ['create', 'read', 'update', 'delete'],
    trainingSchedule:     ['create', 'read', 'update', 'delete'],
    trainingMaterials:    [],
    trainingFeedback:     [],
    employeeScores:       [],
    managementPending:    [],
    skillGap:             ['read'],   // company-wide
  },

  // ── HeadOfDepartment ── same as Manager but also suggests topics
  HeadOfDepartment: {
    capability:           [],
    training:             ['create', 'read', 'update', 'delete'],
    capabilities:         [],
    capabilityAssessment: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],  // can evaluate their team
    trainingSuggestions:  ['create', 'read', 'update', 'delete'],
    trainingSchedule:     ['create', 'read', 'update', 'delete'],
    trainingMaterials:    [],
    trainingFeedback:     [],
    employeeScores:       [],
    managementPending:    [],
    skillGap:             ['read'],   // team-only (backend filters)
  },

  // ── Manager ── evaluates employees, views skill gaps for their team
  Manager: {
    capability:           [],
    training:             ['read'],
    capabilities:         [],
    capabilityAssessment: [],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],  // core manager action
    trainingSuggestions:  ['read'],
    trainingSchedule:     ['read'],
    trainingMaterials:    [],
    trainingFeedback:     [],
    employeeScores:       ['read'],
    managementPending:    [],
    skillGap:             ['read'],   // team-only (backend filters)
  },

  // ── Trainer ── uploads content, reads schedules
  Trainer: {
    capability:           [],
    training:             [],
    capabilities:         [],
    capabilityAssessment: [],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: [],
    trainingSuggestions:  [],
    trainingSchedule:     ['read'],
    trainingMaterials:    ['create', 'read', 'update', 'delete'],
    trainingFeedback:     [],
    employeeScores:       [],
    managementPending:    [],
    skillGap:             [],
  },

  // ── Employee ── takes assessments, gives feedback, views own skill gap
  Employee: {
    capability:           [],
    training:             [],
    capabilities:         [],
    capabilityAssessment: [],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: [],
    trainingSuggestions:  [],
    trainingSchedule:     ['read'],
    trainingMaterials:    ['read'],
    trainingFeedback:     ['create', 'read'],
    employeeScores:       [],
    managementPending:    [],
    skillGap:             ['read'],   // own rows only (backend filters)
  },

  // ── Management ── approves / rejects training plans, views reports
  Management: {
    capability:           ['read'],
    training:             ['read', 'approve', 'reject'],
    capabilities:         [],
    capabilityAssessment: [],
    capabilityRoleMap:    ['read'],
    capabilityEvaluation: ['read'],   // can view evaluations for decision making
    trainingSuggestions:  [],
    trainingSchedule:     ['read', 'approve', 'reject'],
    trainingMaterials:    [],
    trainingFeedback:     [],
    employeeScores:       ['read'],
    managementPending:    ['read', 'approve', 'reject'],
    skillGap:             ['read'],   // company-wide
  },
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

export function getRole(): Role | null {
  if (typeof window === 'undefined') return null;
  const raw  = localStorage.getItem('role') || '';
  const role = LEGACY_ROLE_MAP[raw] || (ROLES.includes(raw as Role) ? (raw as Role) : null);
  return role;
}

export function hasRole(r: Role): boolean {
  return getRole() === r;
}

export function hasAnyRole(roles: Role[]): boolean {
  const current = getRole();
  return current !== null && roles.includes(current);
}

export function can(resource: string, action: string): boolean {
  const role = getRole();
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms || !perms[resource]) return false;
  return perms[resource].includes(action);
}

// ─── Training tab visibility ──────────────────────────────────────────────────

/**
 * Which top-level training tabs to show.
 * Tabs not listed here should be hidden via conditional rendering in TrainingPageImpl / Navbar.
 */
export function trainingTabVisibility(): Record<
  'hr' | 'manager' | 'skillgap' | 'management' | 'employee' | 'delivery' | 'scorecard',
  boolean
> {
  const role = getRole();
  return {
    hr:         role === 'Admin' || role === 'HR',
    manager:    role === 'Admin' || role === 'Manager' || role === 'HeadOfDepartment',
    skillgap:   role === 'Admin' || role === 'HR' || role === 'Manager'
                  || role === 'HeadOfDepartment' || role === 'Management' || role === 'Employee',
    management: role === 'Admin' || role === 'Management',
    employee:   role === 'Admin' || role === 'Employee' || role === 'Trainer',
    delivery:   role === 'Admin' || role === 'HR' || role === 'Management',
    scorecard:  role === 'Admin' || role === 'HR' || role === 'Management',
  };
}

/** HR sub-tab visibility */
export function hrSubTabVisibility(): Record<
  'capability' | 'topics' | 'scheduling',
  boolean
> {
  const role = getRole();
  const isAdmin = role === 'Admin';
  return {
    capability:  isAdmin || role === 'HR',
    topics:      isAdmin || role === 'HR' || role === 'HeadOfDepartment',
    scheduling:  isAdmin || role === 'HR',
  };
}