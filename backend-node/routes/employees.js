const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

router.get('/', async (req, res) => {
    try {
        const employees = await Employee.find();
        res.json({
            data: employees
        })

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    if (req.query.lightweight === 'true') {
        const employees = await Employee.find()
            .select('full_name department designation official_email')
            .sort({ full_name: 1 })
            .lean();

        const formatted = employees.map(emp => ({
            name: emp.full_name || '',
            dept: emp.department || '',
            desig: emp.designation || '',
            email: emp.official_email || ''   // ← important
        }));

        res.json({ success: true, data: formatted });
        }
});

module.exports = router;
