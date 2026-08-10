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
const { authenticate } = require('../middleware/authenticate');
const { PAGE_KEYS, VISIBILITY_ROLES } = require('../config/pages');
const RbacPageVisibility = require('../models/RbacPageVisibility');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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

// ─── GET /api/rbac/page-visibility ────────────────────────────────────────────
// Any logged-in role can read this — Employee/Manager need it to render
// their own sidebar. Missing page keys default to visible (true).

router.get(
  '/page-visibility',
  authenticate,
  asyncHandler(async (req, res) => {
    const doc = (await RbacPageVisibility.findOne()) || {};

    const withDefaults = (roleSettings = {}) => {
      const merged = {};
      for (const key of PAGE_KEYS) {
        merged[key] = roleSettings[key] !== false;
      }
      return merged;
    };

    const data = {};
    for (const role of VISIBILITY_ROLES) {
      data[role] = withDefaults(doc[role]);
    }

    res.json({ success: true, data });
  })
);

// ─── PUT /api/rbac/page-visibility ────────────────────────────────────────────
// Admin/HR submit updated page visibility for Employee/HR/Manager.

router.put(
  '/page-visibility',
  authenticate,
  requireRole(['Admin', 'HR']),
  asyncHandler(async (req, res) => {
    const { pageVisibility } = req.body || {};

    if (!pageVisibility || typeof pageVisibility !== 'object') {
      return res.status(400).json({ success: false, error: 'Missing pageVisibility object' });
    }

    const update = {};
    for (const role of VISIBILITY_ROLES) {
      if (!pageVisibility[role]) continue;
      if (typeof pageVisibility[role] !== 'object') {
        return res.status(400).json({ success: false, error: `Invalid settings for ${role}` });
      }

      const roleSettings = {};
      for (const [key, value] of Object.entries(pageVisibility[role])) {
        if (!PAGE_KEYS.includes(key)) {
          return res.status(400).json({ success: false, error: `Unknown page key: ${key}` });
        }
        roleSettings[key] = Boolean(value);
      }
      update[role] = roleSettings;
    }

    const doc = await RbacPageVisibility.findOneAndUpdate({}, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    res.json({
      success: true,
      message: 'Page visibility updated successfully',
      data: {
        Employee: doc.Employee,
        HR: doc.HR,
        Manager: doc.Manager,
      },
    });
  })
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