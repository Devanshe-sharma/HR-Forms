const RoleMaster = require('../models/role_master');

// Resolves a department NAME (as stored in Onboarding.dept) to that
// department's group email — falling back to the department head's own
// email if no group email is on file. Role Master stores these fields
// per designation row, duplicated across every row for the same
// department, so the first match is enough.
async function resolveDeptContactEmail(deptName) {
  const dept = String(deptName || '').trim();
  if (!dept) return null;

  const escaped = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const role = await RoleMaster.findOne({ department: new RegExp(`^${escaped}$`, 'i') })
    .select('dept_group_email dept_head_email')
    .lean();

  return role?.dept_group_email || role?.dept_head_email || null;
}

module.exports = resolveDeptContactEmail;
