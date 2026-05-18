// ─────────────────────────────────────────────────────────────────────────────
// hiringFormData.js  — ALL data from role_master only
// Exact field names from DB:
//   _id, Dept_Id, Department, Dept Page Link (BO Internal Site),
//   Dept Head Email, Dept Group Email, Parent Department,
//   Department Type (Delivery or Support), Department Head,
//   Desig_id, Designation, Emp_id, desig Email Id, Emp_name,
//   JD Link, Reporting Manager
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');

const col = () => mongoose.connection.collection('role_master');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hiring-form/all
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const docs = await col().find({}).toArray();

    // ── 1. EMPLOYEES (rows where Emp_name is filled) ─────────────────────────
    const empMap = new Map();
    for (const doc of docs) {
      const empName = doc['Emp_name'] || '';
      if (!empName) continue;

      const empId = doc['Emp_id'] || '';
      const key   = empId || empName;
      if (empMap.has(key)) continue;

      empMap.set(key, {
        emp_id:         empId,
        full_name:      empName,
        official_email: doc['desig Email Id'] || '',
        department:     doc['Department']     || '',
        designation:    doc['Designation']    || '',
      });
    }
    const employees = [...empMap.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );

    // ── 2. DEPARTMENTS ────────────────────────────────────────────────────────
    const deptMap = new Map();
    for (const doc of docs) {
      const deptId   = doc['Dept_Id']     || '';
      const deptName = doc['Department']  || '';
      if (!deptName) continue;
      const key = String(deptId) || deptName;
      if (deptMap.has(key)) continue;

      deptMap.set(key, {
        dept_id:          deptId,
        department:       deptName,
        dept_head_email:  doc['Dept Head Email']                        || '',
        dept_group_email: doc['Dept Group Email']                       || '',
        dept_page_link:   doc['Dept Page Link (BO Internal Site)']      || '',
        department_type:  doc['Department Type (Delivery or Support)']  || '',
        department_head:  doc['Department Head']                        || '',
      });
    }
    const departments = [...deptMap.values()].sort((a, b) =>
      a.department.localeCompare(b.department)
    );

    // ── 3. DESIGNATIONS ───────────────────────────────────────────────────────
    const desigMap = new Map();
    for (const doc of docs) {
      const desigName = doc['Designation'] || '';
      const deptName  = doc['Department']  || '';
      const key       = `${deptName}__${desigName}`;
      if (!desigName || desigMap.has(key)) continue;

      desigMap.set(key, {
        desig_id:           doc['Desig_id']  || '',
        designation:        desigName,
        department:         deptName,
        dept_id:            doc['Dept_Id']   || '',
        role_document_link: doc['role_document_link'] || '',
        jd_link:            doc['JD Link']   || '',
      });
    }
    const designations = [...desigMap.values()].sort((a, b) =>
      a.designation.localeCompare(b.designation)
    );

    // ── 4. NEXT SERIAL ────────────────────────────────────────────────────────
    let nextSerial = 1;
    try {
      const reqCol = mongoose.connection.collection('hiring_requisitions');
      const latest = await reqCol
        .find({}, { projection: { serial_no: 1 } })
        .sort({ serial_no: -1 })
        .limit(1)
        .toArray();
      if (latest.length > 0 && latest[0].serial_no) {
        nextSerial = Number(latest[0].serial_no) + 1;
      }
    } catch (_) { /* collection may not exist yet */ }

    // ── 5. STATIC OPTIONS ─────────────────────────────────────────────────────
    const joiningDaysOptions = [
      { value: '20 days', label: '20 days = joining at 0 days notice' },
      { value: '35 days', label: '35 days = joining at 15-days notice' },
      { value: '50 days', label: '50 days = joining at 30-days notice' },
      { value: '80 days', label: '80 days = joining at 60-days notice' },
    ];

    const hiringStatusOptions = [
      'New',
      'No Change in Status',
      'On Hold',
      'Cancelled',
      'Filled Internally',
      'Filled Externally',
    ];

    return res.status(200).json({
      success: true,
      data: {
        next_serial:           nextSerial,
        employees,
        departments,
        designations,
        joining_days_options:  joiningDaysOptions,
        hiring_status_options: hiringStatusOptions,
      },
    });

  } catch (err) {
    console.error('hiring-form/all error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hiring-form/designations?department=Engineering
// ─────────────────────────────────────────────────────────────────────────────
router.get('/designations', async (req, res) => {
  try {
    const { department } = req.query;
    const filter = department
      ? { Department: { $regex: new RegExp(`^${department}$`, 'i') } }
      : {};

    const docs = await col().find(filter).toArray();
    const desigMap = new Map();

    for (const doc of docs) {
      const name = doc['Designation'] || '';
      const dept = doc['Department']  || '';
      const key  = `${dept}__${name}`;
      if (!name || desigMap.has(key)) continue;
      desigMap.set(key, {
        desig_id:           doc['Desig_id'] || '',
        designation:        name,
        department:         dept,
        dept_id:            doc['Dept_Id']  || '',
        role_document_link: doc['role_document_link'] || '',
        jd_link:            doc['JD Link']  || '',
      });
    }

    const data = [...desigMap.values()].sort((a, b) =>
      a.designation.localeCompare(b.designation)
    );
    return res.status(200).json({ success: true, count: data.length, data });

  } catch (err) {
    console.error('hiring-form/designations error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;