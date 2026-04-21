const RoleMaster = require('../models/role_master');

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildRoleFilters(query = {}) {
  const filters = {};

  const deptId = normalizeString(query.dept_id);
  const department = normalizeString(query.department);
  const managementLevel = normalizeString(query.management_level);
  const reportingManager = normalizeString(query.reporting_manager);

  if (deptId) {
    filters.dept_id = deptId;
  }

  if (department) {
    filters.department = new RegExp(`^${escapeRegex(department)}$`, 'i');
  }

  if (managementLevel) {
    filters.management_level = new RegExp(`^${escapeRegex(managementLevel)}$`, 'i');
  }

  if (reportingManager) {
    filters.reporting_manager = new RegExp(escapeRegex(reportingManager), 'i');
  }

  return filters;
}

async function getRoles(req, res) {
  try {
    const filters = buildRoleFilters(req.query);
    const roles = await RoleMaster.find(filters).sort({ department: 1, designation: 1, desig_id: 1 }).lean();

    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  buildRoleFilters,
  getRoles,
};
