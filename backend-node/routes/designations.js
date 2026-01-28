const express = require('express');
const router = express.Router();
const Designation = require('../models/Designation');

router.get('/', async (req, res) => {
    try {
        const designations = await Designation.find();
        res.json(designations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
