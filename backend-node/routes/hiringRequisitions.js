const express = require('express');
const router = express.Router();
const HiringRequisition = require('../models/HiringRequisition'); // your mongoose model

router.post('/', async (req, res) => {
  try {
    const data = req.body;

    const newRequisition = new HiringRequisition(data);
    await newRequisition.save();

    res.status(201).json({
      message: 'Hiring requisition saved successfully!',
      data: newRequisition
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save hiring requisition' });
  }
});

module.exports = router;
