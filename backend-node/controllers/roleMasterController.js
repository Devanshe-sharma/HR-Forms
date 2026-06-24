const mongoose = require('mongoose');

const COLLECTION = 'role_master';

const getCollection = () => mongoose.connection.collection(COLLECTION);
const g = (doc, capitalKey, snakeKey) => doc[capitalKey] ?? doc[snakeKey] ?? '';
const gNum = (doc, capitalKey, snakeKey) => doc[capitalKey] ?? doc[snakeKey] ?? null;

// ── Normalise a single raw doc ───────────────────────────────────────────────
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
  Emp_id:           doc.Emp_id            ?? '',
  Emp_name:         doc.Emp_name          ?? '',
  DesigEmailId:     doc['desig Email Id'] ?? '',
  JDLink:           doc['JD Link']        ?? '',
  ReportingManager: doc['Reporting Manager'] ?? '',
});

const buildRoleFilters = ({ department, designation, dept_id } = {}) => {
  const filter = {};
  if (department)  filter['Department']  = { $regex: new RegExp(`^${department}$`,  'i') };
  if (designation) filter['Designation'] = { $regex: new RegExp(`^${designation}$`, 'i') };
  if (dept_id)     filter['Dept_Id']     = Number(dept_id);
  return filter;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/roles
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
    return res.status(500).json({ success: false, error: 'Failed to fetch roles', details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rolemaster/all
// Returns departments + designations + employees shaped for NewOnboarding.tsx
// ─────────────────────────────────────────────────────────────────────────────
const getAllFormData = async (req, res) => {
  try {
    const col  = getCollection();
    const docs = await col.find({}).toArray();

    // ── 1. Unique departments ──────────────────────────────────────────────
    // ── 1. Unique departments ──────────────────────────────────────────────
const deptMap = new Map();
docs.forEach((doc) => {
  const id = gNum(doc, 'Dept_Id', 'dept_id');
  if (id != null && !deptMap.has(id)) {
    deptMap.set(id, {
      dept_id:          id,
      department:       g(doc, 'Department', 'department'),
      dept_page_link:   g(doc, 'Dept Page Link (BO Internal Site)', 'dept_page_link'),
      dept_head_email:  g(doc, 'Dept Head Email', 'dept_head_email'),
      dept_group_email: g(doc, 'Dept Group Email', 'dept_group_email'),
    });
  }
});
const departments = Array.from(deptMap.values())
  .filter(d => d.department)   // skip blank
  .sort((a, b) => a.department.localeCompare(b.department));

// ── 2. All designations ────────────────────────────────────────────────
const desigMap = new Map();
docs.forEach((doc) => {
  const deptId  = gNum(doc, 'Dept_Id', 'dept_id');
  const desigId = gNum(doc, 'Desig_id', 'desig_id');
  const key = `${deptId}_${desigId}`;
  if (!desigMap.has(key)) {
    desigMap.set(key, {
      dept_id:            deptId,
      department:         g(doc, 'Department', 'department'),
      desig_id:           desigId,
      designation:        g(doc, 'Designation', 'designation'),
      role_document_link: g(doc, 'Role Document Link', 'role_document_link'),
      jd_link:            g(doc, 'JD Link', 'jd_link'),
    });
  }
});
const designations = Array.from(desigMap.values())
  .filter(d => d.department && d.designation)  // skip blank rows
  .sort((a, b) =>
    a.department.localeCompare(b.department) ||
    a.designation.localeCompare(b.designation)
  );

// ── 3. Employees ───────────────────────────────────────────────────────
const employees = docs
  .filter((doc) => {
    const name = g(doc, 'Emp_name', 'emp_name');
    return name && name.trim() !== '';
  })
  .map((doc) => ({
    emp_id:         String(gNum(doc, 'Emp_id', 'emp_id') ?? ''),
    full_name:      g(doc, 'Emp_name', 'emp_name'),
    official_email: g(doc, 'desig Email Id', 'desig_email_id'),
    department:     g(doc, 'Department', 'department'),
    designation:    g(doc, 'Designation', 'designation'),
  }))
  .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return res.status(200).json({
      data: { departments, designations, employees },
    });
  } catch (error) {
    console.error('getAllFormData error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch form data', details: error.message });
  }
};

module.exports = { buildRoleFilters, getRoles, getAllFormData };