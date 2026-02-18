// routes/designations.js
const express = require('express');
const router = express.Router();
const Designation = require('../models/Designation');

router.get('/', async (req, res) => {
    try {
        const designations = await Designation.find().sort({ designation: 1 });
        res.json({ success: true, data: designations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
