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
});

module.exports = router;
