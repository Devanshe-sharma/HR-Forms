const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

router.get('/', async (req, res) => {
    try {
        // 1. Check for lightweight query FIRST
        if (req.query.lightweight === 'true') {
            const employees = await Employee.find()
                .select('full_name department designation official_email score')
                .sort({ full_name: 1 })
                .lean();

            const formatted = employees.map(emp => ({
                name: emp.full_name || '',
                dept: emp.department || '',
                desig: emp.designation || '',
                email: emp.official_email || '',
                score: emp.score || 0
            }));

            // Use 'return' to stop the function here
            return res.json({ success: true, data: formatted });
        }

        // 2. Default logic (Full Employee List)
        const employees = await Employee.find();
        
        // Use 'return' here as well for good measure
        return res.json({
            success: true,
            data: employees
        });

    } catch (err) {
        // Always 'return' on errors to prevent further execution
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;