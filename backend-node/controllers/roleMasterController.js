const mongoose = require('mongoose');

const COLLECTION = 'role_master';

const getCollection = () => mongoose.connection.collection(COLLECTION);

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
    const deptMap = new Map();
    docs.forEach((doc) => {
      const id = doc.Dept_Id;
      if (id != null && !deptMap.has(id)) {
        deptMap.set(id, {
          dept_id:        id,
          department:     doc.Department ?? '',
          dept_page_link: doc['Dept Page Link (BO Internal Site)'] ?? '',
          dept_head_email:doc['Dept Head Email'] ?? '',
          dept_group_email:doc['Dept Group Email'] ?? '',
        });
      }
    });
    const departments = Array.from(deptMap.values())
      .sort((a, b) => a.department.localeCompare(b.department));

    // ── 2. All designations with their department ──────────────────────────
    // One entry per unique dept_id + desig_id combo
    const desigMap = new Map();
    docs.forEach((doc) => {
      const key = `${doc.Dept_Id}_${doc.Desig_id}`;
      if (!desigMap.has(key)) {
        desigMap.set(key, {
          dept_id:            doc.Dept_Id    ?? null,
          department:         doc.Department ?? '',
          desig_id:           doc.Desig_id   ?? null,
          designation:        doc.Designation ?? '',
          role_document_link: doc['Role Document Link'] ?? '',
          jd_link:            doc['JD Link'] ?? '',
        });
      }
    });
    const designations = Array.from(desigMap.values())
      .sort((a, b) =>
        a.department.localeCompare(b.department) ||
        a.designation.localeCompare(b.designation)
      );

    // ── 3. Employees (rows that have a name) ───────────────────────────────
    // Normalised to match RoleEmployee type in NewOnboarding.tsx:
    // { emp_id, full_name, official_email, department, designation }
    const employees = docs
      .filter((doc) => doc.Emp_name && doc.Emp_name.trim() !== '')
      .map((doc) => ({
        emp_id:         String(doc.Emp_id   ?? ''),
        full_name:      doc.Emp_name         ?? '',
        official_email: doc['desig Email Id'] ?? '',
        department:     doc.Department        ?? '',
        designation:    doc.Designation       ?? '',
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