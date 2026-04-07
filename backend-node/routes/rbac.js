/**
 * backend-node/routes/rbac.js
 *
 * Endpoints for HR to read and update role permissions at runtime.
 * Mount in index.js:  app.use('/api/rbac', require('./routes/rbac'));
 *
 * Endpoints:
 *   GET  /api/rbac/permissions          → returns current Manager + Employee permissions
 *   PUT  /api/rbac/permissions          → HR saves updated permissions
 */

const express = require('express');
const router = express.Router();
const { requireRole, ROLE_PERMISSIONS } = require('../config/roles');

// ── In-memory override store (replace with DB persistence if needed) ──────────
// On server start this mirrors the static ROLE_PERMISSIONS from roles.js.
// HR changes are applied here and propagate via getEffectivePermissions().

const permissionOverrides = {
  Manager: { ...ROLE_PERMISSIONS.Manager },
  Employee: { ...ROLE_PERMISSIONS.Employee },
};

/**
 * Locked permissions that HR cannot remove — minimum required for system integrity.
 * Mirror of HR_LOCKED in PermissionManager.tsx
 */
const HR_LOCKED = {
  Manager: {
    capabilityEvaluation: ['create', 'read', 'update', 'delete'],
    capabilityRoleMap:    ['read'],
    skillGap:             ['read'],
    employeeScores:       ['read'],
  },
  Employee: {
    trainingSchedule:  ['read'],
    trainingMaterials: ['read'],
    trainingFeedback:  ['create', 'read'],
    capabilityRoleMap: ['read'],
    skillGap:          ['read'],
  },
};

/**
 * Merge submitted permissions with locked ones so HR cannot remove locked actions.
 */
function applyLocks(role, submitted) {
  const locked = HR_LOCKED[role] || {};
  const merged = { ...submitted };
  for (const [resource, lockedActions] of Object.entries(locked)) {
    const current = merged[resource] || [];
    // Ensure every locked action is present
    const combined = [...new Set([...current, ...lockedActions])];
    merged[resource] = combined;
  }
  return merged;
}

/**
 * Validate that submitted permissions only contain known actions.
 */
const VALID_ACTIONS = new Set(['create', 'read', 'update', 'delete', 'approve', 'reject']);

function validatePermissions(perms) {
  if (typeof perms !== 'object' || perms === null) return false;
  for (const [, actions] of Object.entries(perms)) {
    if (!Array.isArray(actions)) return false;
    for (const a of actions) {
      if (!VALID_ACTIONS.has(a)) return false;
    }
  }
  return true;
}

// ─── GET /api/rbac/permissions ────────────────────────────────────────────────
// Returns current effective permissions for Manager and Employee.

router.get(
  '/permissions',
  requireRole(['Admin', 'HR']),
  (req, res) => {
    res.json({
      success: true,
      data: {
        Manager: permissionOverrides.Manager,
        Employee: permissionOverrides.Employee,
      },
      locked: HR_LOCKED,
    });
  }
);

// ─── PUT /api/rbac/permissions ────────────────────────────────────────────────
// HR submits updated permissions for Manager and/or Employee.

router.put(
  '/permissions',
  requireRole(['Admin', 'HR']),
  (req, res) => {
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, error: 'Missing permissions object' });
    }

    const MANAGED_ROLES = ['Manager', 'Employee'];

    for (const role of MANAGED_ROLES) {
      if (!permissions[role]) continue;

      if (!validatePermissions(permissions[role])) {
        return res.status(400).json({
          success: false,
          error: `Invalid actions in ${role} permissions`,
        });
      }

      // Apply locks (re-add any locked actions HR may have tried to remove)
      permissionOverrides[role] = applyLocks(role, permissions[role]);
    }

    // ── Persist to DB (optional — add your Mongoose model here) ──────────────
    // await RbacPermissions.findOneAndUpdate(
    //   {},
    //   { Manager: permissionOverrides.Manager, Employee: permissionOverrides.Employee },
    //   { upsert: true }
    // );

    console.log(`[RBAC] Permissions updated by ${req.role} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      data: {
        Manager: permissionOverrides.Manager,
        Employee: permissionOverrides.Employee,
      },
    });
  }
);

// ─── Export helper so other routes can use runtime permissions ────────────────

/**
 * Get the current effective permissions for a role.
 * Use this in your other routes instead of ROLE_PERMISSIONS directly
 * if you want HR overrides to take effect at runtime.
 *
 * Example:
 *   const { getEffectivePermissions } = require('./rbac');
 *   const perms = getEffectivePermissions('Manager');
 *   if (perms.trainingMaterials?.includes('read')) { ... }
 */
function getEffectivePermissions(role) {
  if (permissionOverrides[role]) return permissionOverrides[role];
  return ROLE_PERMISSIONS[role] || {};
}

module.exports = router;
module.exports.getEffectivePermissions = getEffectivePermissions;