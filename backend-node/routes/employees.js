// routes/employees.js
// CRITICAL: lightweight mode MUST return _id so dashboard can match
// hygienes.employeeId / growths.employeeId / rolekpis.employeeId
// All three collections store the Employee MongoDB _id as their employeeId field

const express  = require('express');
const router   = express.Router();
const Employee = require('../models/Employee');

router.get('/', async (req, res) => {
  try {
    if (req.query.email) {
      const email = String(req.query.email).trim();
      const employees = await Employee.find({
        isArchived: { $ne: true },
        $or: [
          { official_email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { personal_email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
      });
      return res.json({ success: true, data: employees });
    }

    if (req.query.lightweight === 'true') {
      const employees = await Employee.find({ isArchived: { $ne: true } })
        .select('_id full_name department designation official_email score')
        .sort({ full_name: 1 })
        .lean();

      const formatted = employees.map(emp => ({
        _id:         emp._id,               // ObjectId — used to match employeeId in hygienes/growths/rolekpis
        name:        emp.full_name    || '',
        department:  emp.department   || '',
        designation: emp.designation  || '',
        email:       emp.official_email || String(emp._id), // unique React key
        score:       emp.score        || 0,
      }));

      return res.json({ success: true, data: formatted });
    }

    const employees = await Employee.find({ isArchived: { $ne: true } });
    return res.json({ success: true, data: employees });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/review-period - Get employees eligible for performance review
router.get('/review-period', async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const employees = await Employee.find({
      joining_date: { $gte: sixMonthsAgo, $lte: now }
    })
    .select('_id employee_id full_name department designation joining_date level official_email')
    .sort({ full_name: 1 })
    .lean();

    const formatted = employees.map(emp => ({
      _id: emp._id,
      employee_id: emp.employee_id || '',
      name: emp.full_name || '',
      department: emp.department || '',
      designation: emp.designation || '',
      email: emp.official_email || '',
      joining_date: emp.joining_date || '',
      level: emp.level || 1,
      months_in_service: Math.max(0, Math.floor((now - new Date(emp.joining_date)) / (1000 * 60 * 60 * 24 * 30))),
      review_status: 'pending'
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching review period employees:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/archived - Get archived employees
router.get('/archived', async (req, res) => {
  try {
    const employees = await Employee.find({ isArchived: true })
      .sort({ archivedAt: -1 });
    return res.json({ success: true, data: employees });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/personal-info - Self-service update of Profile page
// personal info fields only. Scoped to an allowlist so this can never be used
// to touch HR-managed fields (salary, department, designation, etc.).
const PERSONAL_INFO_FIELDS = [
  'citizenship', 'nationality', 'passportNo', 'passportValidUpto', 'passportIssuePlace',
  'bankName', 'bankAccountNo', 'ifscCode', 'panCard', 'aadhaarNo', 'uanNo', 'ePassbookLink',
  'birthday', 'bloodGroup', 'maritalStatus',
  'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'emergencyContactPlace',
  'familyFather', 'familyMother', 'familySiblings', 'familySpouse', 'familyChildren',
];

router.put('/:id/personal-info', async (req, res) => {
  try {
    const update = {};
    for (const key of PERSONAL_INFO_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error updating personal info:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/archive - Archive an employee
router.put('/:id/archive', async (req, res) => {
  try {
    console.log(`Archiving employee with ID: ${req.params.id}`);
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { 
        isArchived: true,
        archivedAt: new Date()
      },
      { new: true }
    );
    
    if (!employee) {
      console.log(`Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    
    console.log(`Successfully archived employee: ${employee.full_name} (${employee.employee_id})`);
    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error archiving employee:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/unarchive - Unarchive an employee
router.put('/:id/unarchive', async (req, res) => {
  try {
    console.log(`Unarchiving employee with ID: ${req.params.id}`);
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { 
        isArchived: false,
        archivedAt: null
      },
      { new: true }
    );
    
    if (!employee) {
      console.log(`Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    
    console.log(`Successfully unarchived employee: ${employee.full_name} (${employee.employee_id})`);
    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error unarchiving employee:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;