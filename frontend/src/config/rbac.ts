/**
 * Centralized RBAC for frontend. Never hardcode role checks in components.
 * Map localStorage "role" to internal role and use can() / hasRole().
 */

export const ROLES = [
  'Admin',
  'HR',
  'HeadOfDepartment',
  'Trainer',
  'Employee',
  'Management',
] as const;

export type Role = (typeof ROLES)[number];

/** Map legacy localStorage role values to RBAC role */
const LEGACY_ROLE_MAP: Record<string, Role> = {
  'HR Department': 'HR',
  'DAA Department': 'Admin',
  'Employees and outsiders': 'Employee',
  Admin: 'Admin',
  HR: 'HR',
  HeadOfDepartment: 'HeadOfDepartment',
  Trainer: 'Trainer',
  Employee: 'Employee',
  Management: 'Management',
};

const ROLE_PERMISSIONS: Record<Role, Record<string, string[]>> = {
  Admin: {
    capability: ['create', 'read', 'update', 'delete'],
    training: ['create', 'read', 'update', 'delete'],
    capabilities: ['create', 'read', 'update', 'delete'],
    capabilityAssessment: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap: ['read'],
    trainingSuggestions: ['create', 'read', 'update', 'delete'],
    trainingSchedule: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    trainingMaterials: ['create', 'read', 'update', 'delete'],
    trainingFeedback: ['read'],
    employeeScores: ['read'],
    managementPending: ['read', 'approve', 'reject'],
  },
  HR: {
    capability: ['create', 'read', 'update', 'delete'],
    training: ['create', 'read', 'update', 'delete'],
    capabilities: ['create', 'read', 'update', 'delete'],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    trainingSuggestions: ['create', 'read', 'update', 'delete'],
    trainingSchedule: ['create', 'read', 'update', 'delete'],
    trainingMaterials: [],
    trainingFeedback: [],
    employeeScores: [],
    managementPending: [],
  },
  HeadOfDepartment: {
    capability: [],
    training: ['create', 'read', 'update', 'delete'],
    capabilities: [],
    capabilityAssessment: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap: ['read'],
    trainingSuggestions: ['create', 'read', 'update', 'delete'],
    trainingSchedule: ['create', 'read', 'update', 'delete'],
    trainingMaterials: [],
    trainingFeedback: [],
    employeeScores: [],
    managementPending: [],
  },
  Trainer: {
    capability: [],
    training: [],
    capabilities: [],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    trainingSuggestions: [],
    trainingSchedule: ['read'],
    trainingMaterials: ['create', 'read', 'update', 'delete'],
    trainingFeedback: [],
    employeeScores: [],
    managementPending: [],
  },
  Employee: {
    capability: [],
    training: [],
    capabilities: [],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    trainingSuggestions: [],
    trainingSchedule: ['read'],
    trainingMaterials: ['read'],
    trainingFeedback: ['create', 'read'],
    employeeScores: [],
    managementPending: [],
  },
  Management: {
    capability: ['read'],
    training: ['read', 'approve', 'reject'],
    capabilities: [],
    capabilityAssessment: [],
    capabilityRoleMap: ['read'],
    trainingSuggestions: [],
    trainingSchedule: ['read', 'approve', 'reject'],
    trainingMaterials: [],
    trainingFeedback: [],
    employeeScores: ['read'],
    managementPending: ['read', 'approve', 'reject'],
  },
};

export function getRole(): Role | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('role') || '';
  const role = LEGACY_ROLE_MAP[raw] || (ROLES.includes(raw as Role) ? (raw as Role) : null);
  return role;
}

export function hasRole(r: Role): boolean {
  const current = getRole();
  return current === r;
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

/** Which main tabs to show in Training - 4 Model Structure */
export function trainingTabVisibility(): Record<'capability' | 'topics' | 'approval' | 'scheduling', boolean> {
  const role = getRole();
  return {
    capability: role === 'Admin' || role === 'HR' || role === 'Management',
    topics: role === 'Admin' || role === 'HR' || role === 'HeadOfDepartment',
    approval: role === 'Admin' || role === 'Management',
    scheduling: role === 'Admin' || role === 'HR',
  };
}

/** Which HR sub-tabs to show */
export function hrSubTabVisibility(): Record<'capabilityList' | 'capabilityAssessment' | 'capabilityRoleMap' | 'trainingSuggestion' | 'trainingSchedule', boolean> {
  const role = getRole();
  const all = role === 'Admin';
  return {
    capabilityList: all || role === 'HR',
    capabilityAssessment: all || role === 'HeadOfDepartment',
    capabilityRoleMap: true,
    trainingSuggestion: all || role === 'HR' || role === 'HeadOfDepartment',
    trainingSchedule: all || role === 'HR' || role === 'HeadOfDepartment',
  };
}
