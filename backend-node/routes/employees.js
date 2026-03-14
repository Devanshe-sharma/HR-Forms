// routes/employees.js
// CRITICAL: lightweight mode MUST return _id so dashboard can match
// hygienes.employeeId / growths.employeeId / rolekpis.employeeId
// All three collections store the Employee MongoDB _id as their employeeId field

const express  = require('express');
const router   = express.Router();
const Employee = require('../models/Employee');

router.get('/', async (req, res) => {
  try {
    if (req.query.lightweight === 'true') {
      const employees = await Employee.find()
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

    const employees = await Employee.find();
    return res.json({ success: true, data: employees });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;