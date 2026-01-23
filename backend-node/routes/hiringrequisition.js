const express = require('express');
const router = express.Router();
const HiringRequisition = require('../models/HiringRequisition');

router.post('/', async (req, res) => {
    try {
        const newReq = new HiringRequisition(req.body);
        await newReq.save();
        res.status(201).json({ message: 'Hiring requisition saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
