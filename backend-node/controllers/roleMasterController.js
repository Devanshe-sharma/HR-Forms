const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Use the raw collection directly via mongoose.connection so we are NOT
// constrained by the schema field names — the actual MongoDB documents use
// keys with spaces and mixed casing that differ from the Mongoose schema.
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTION = 'role_master';

/**
 * Returns the raw role_master collection handle.
 * Safe to call after mongoose is connected.
 */
const getCollection = () => mongoose.connection.collection(COLLECTION);

/**
 * Map one raw MongoDB document → clean normalised object.
 *
 * Actual field names in the DB (from the live document):
 *   Dept_Id
 *   Department
 *   'Dept Page Link (BO Internal Site)'
 *   'Dept Head Email'
 *   'Dept Group Email'
 *   'Parent Department'
 *   'Department Type (Delivery or Support)'
 *   'Department Head'
 *   Desig_id
 *   Designation
 *   Emp_id          ← note lowercase 'd'
 *   Emp_name        ← note lowercase 'n'
 *   'desig Email Id'
 *   'JD Link'
 *   'Reporting Manager'
 */
const normaliseDoc = (doc) => ({
  _id:              doc._id,
  Dept_Id:          doc.Dept_Id          ?? null,
  Department:       doc.Department        ?? '',
  DeptPageLink:     doc['Dept Page Link (BO Internal Site)'] ?? '',
  DeptHeadEmail:    doc['Dept Head Email']                   ?? '',
  DeptGroupEmail:   doc['Dept Group Email']                  ?? '',
  ParentDepartment: doc['Parent Department']                 ?? '',
  DepartmentType:   doc['Department Type (Delivery or Support)'] ?? '',
  DepartmentHead:   doc['Department Head']                   ?? '',
  Desig_id:         doc.Desig_id         ?? null,
  Designation:      doc.Designation       ?? '',
  Emp_id:           doc.Emp_id            ?? '',   // number or string in DB
  Emp_name:         doc.Emp_name          ?? '',
  DesigEmailId:     doc['desig Email Id'] ?? '',
  JDLink:           doc['JD Link']        ?? '',
  ReportingManager: doc['Reporting Manager'] ?? '',
});

/**
 * Build a mongo filter from optional query params.
 * We match against the ACTUAL field names in the collection.
 */
const buildRoleFilters = ({ department, designation, dept_id } = {}) => {
  const filter = {};
  if (department)  filter['Department']  = { $regex: new RegExp(`^${department}$`,  'i') };
  if (designation) filter['Designation'] = { $regex: new RegExp(`^${designation}$`, 'i') };
  if (dept_id)     filter['Dept_Id']     = Number(dept_id);
  return filter;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/roles
// Query params (all optional):
//   ?department=Manufacturing
//   ?designation=Mechanical Design Engineer
//   ?dept_id=17
// ─────────────────────────────────────────────────────────────────────────────
const getRoles = async (req, res) => {
  try {
    const col    = getCollection();
    const filter = buildRoleFilters(req.query);
    const docs   = await col.find(filter).toArray();
    const data   = docs.map(normaliseDoc);

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('getRoles error:', error);
    return res.status(500).json({
      success: false,
      error:   'Failed to fetch roles',
      details: error.message,
    });
  }
};

module.exports = { buildRoleFilters, getRoles };