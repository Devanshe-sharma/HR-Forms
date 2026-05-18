const express = require('express');
const router = express.Router();
const HiringRequisition = require('../models/HiringRequisition');

// GET /api/hiringrequisitions/ — fetch all for dashboard
router.get('/', async (req, res) => {
  try {
    const data = await HiringRequisition.find({}).sort({ createdAt: -1 });
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch hiring requisitions' });
  }
});

// POST /api/hiringrequisitions/ — save new requisition from form
router.post('/', async (req, res) => {
  try {
    const newRequisition = new HiringRequisition(req.body);
    await newRequisition.save();
    res.status(201).json({
      message: 'Hiring requisition saved successfully!',
      data: newRequisition,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save hiring requisition' });
  }
});

module.exports = router;