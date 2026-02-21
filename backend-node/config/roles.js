/**
 * Centralized RBAC: roles and permissions.
 * Use with requireRole() middleware. Never hardcode role checks in route handlers.
 */

const ROLES = Object.freeze([
  'Admin',
  'HR',
  'HeadOfDepartment',
  'Trainer',
  'Employee',
  'Management',
]);

const ROLE_PERMISSIONS = Object.freeze({
  Admin: {
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
});

/**
 * Check if role has permission for resource.action
 * @param {string} role
 * @param {string} resource - e.g. 'capabilities', 'trainingSchedule'
 * @param {string} action - 'create'|'read'|'update'|'delete'|'approve'|'reject'
 */
function can(role, resource, action) {
  if (!role || !ROLES.includes(role)) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms || !perms[resource]) return false;
  return perms[resource].includes(action);
}

/**
 * Require one of the given roles (for middleware).
 * Expects req.headers['x-user-role'] or req.user?.role to be set (e.g. by auth middleware).
 */
function requireRole(allowedRoles) {
  const set = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
  return (req, res, next) => {
    const role = (req.role || req.headers['x-user-role'] || req.user?.role || '').trim();
    if (!role) {
      return res.status(401).json({ success: false, error: 'Role not provided' });
    }
    if (!ROLES.includes(role)) {
      return res.status(403).json({ success: false, error: 'Invalid role' });
    }
    if (!set.has(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    req.role = role;
    next();
  };
}

/**
 * Require permission for resource.action (uses role from req.role or header).
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    const role = (req.role || req.headers['x-user-role'] || req.user?.role || '').trim();
    if (!role || !can(role, resource, action)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  can,
  requireRole,
  requirePermission,
};
