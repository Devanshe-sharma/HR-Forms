const Onboarding = require('../models/onboardingModel');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

/**
 * The same employee list shown on the Employees List page — sourced from
 * Onboarding (the master record for this data), not the Employee collection.
 * Shared by the internal /api/onboarding/employee-master route and the
 * external /api/external/employees API.
 */
async function getEmployeeMasterList() {
  const docs = await Onboarding.find(
    {},
    'name gender empId dept designation officialEmail persEmail mobile joiningStatus exitStatus joinedDate reportingHead employeeCategory managementLevel'
  ).lean();

  return docs.map((d) => {
    const isExited = EXITED_STATUS_VALUES.has(d.exitStatus || '');
    const isCurrent = d.joiningStatus === 'Joined' && !isExited;
    return {
      _id: String(d._id),
      employee_id: d.empId || String(d._id),
      full_name: d.name || '',
      gender: d.gender || '',
      department: d.dept || '',
      designation: d.designation || '',
      official_email: d.officialEmail || '',
      personal_email: d.persEmail || '',
      email: d.officialEmail || d.persEmail || '',
      mobile: d.mobile || '',
      joining_date: d.joinedDate || null,
      employee_category: d.employeeCategory || '',
      management_level: d.managementLevel || '',
      reporting_head: d.reportingHead || '',
      exit_status: d.exitStatus || '',
      is_current: isCurrent,
      is_exited: isExited,
    };
  });
}

module.exports = { getEmployeeMasterList };
