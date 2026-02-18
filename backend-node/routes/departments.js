// routes/departments.js
const express = require('express');
const router = express.Router();
const Department = require('../models/Department');

router.get('/', async (req, res) => {
    try {
        const departments = await Department.find().sort({ department: 1 });
        // Return flat array with { success, data } wrapper so frontend handles it uniformly
        res.json({ success: true, data: departments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
