const express = require('express');
const router = express.Router();
const Designation = require('../models/Designation');

router.get('/', async (req, res) => {
    const { department } = req.query;
    if (!department) return res.status(400).json({ error: 'department query param required' });

    try {
        const designations = await Designation.find({ model: 'hr.designation' });
        // filter designations by department id (string matching assumed)
        const filtered = designations.filter(d => d.fields.department === department);
        const clean = filtered.map(d => ({
            id: d._id,
            name: d.fields.name,
        }));
        res.json(clean);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
