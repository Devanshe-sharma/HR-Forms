// routes/training.js
const express = require('express');
const router = express.Router();
const Training = require('../models/Training'); // make sure path is correct

// 1. CREATE new training / proposal / suggestion
router.post('/', async (req, res) => {
  try {
    console.log("Receiving Payload:", req.body);
    
    const newTraining = new Training(req.body);
    
    // The .save() call triggers the pre('save') middleware
    const savedTraining = await newTraining.save();
    
    res.status(201).json({
      success: true,
      data: savedTraining
    });
  } catch (err) {
    // Log the full error in your terminal to catch middleware bugs
    console.error("POST /api/training ERROR:", err);
    
    res.status(400).json({
      success: false,
      error: err.message || "Validation failed"
    });
  }
});

// 2. GET all trainings (with query filters for tabs)
router.get('/', async (req, res) => {
  try {
    const query = req.query;

    const filter = {};

    // Support comma-separated status: ?status=Proposed,Under Review,Approved
    if (query.status) {
      filter.status = { $in: query.status.split(',').map(s => s.trim()) };
    }

    if (query.proposedByRole) filter.proposedByRole = query.proposedByRole;
    if (query.priority) filter.priority = query.priority;
    if (query.quarter) filter.quarter = query.quarter;
    if (query.financialYear) filter.financialYear = query.financialYear;
    if (query.trainerEmployeeId) filter['trainer.employee'] = query.trainerEmployeeId;
    if (query.feedbackEmployeeId) filter['feedbacks.employee'] = query.feedbackEmployeeId;

    const limit = parseInt(query.limit) || 20;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    const trainings = await Training.find(filter)
      .sort({ trainingDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Training.countDocuments(filter);

    res.json({
      success: true,
      count: trainings.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: trainings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET single training by ID
router.get('/:id', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    res.json({ success: true, data: training });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. UPDATE training (edit fields, change status, schedule, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    res.json({ success: true, data: training });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. SUBMIT FEEDBACK for a training
router.post('/:id/feedback', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    // You can add check to prevent duplicate feedback later
    training.feedbacks.push(req.body);
    await training.save();

    res.json({ success: true, data: training });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. ARCHIVE training (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    training.status = 'Archived';
    training.archivedAt = new Date();
    await training.save();

    res.json({ success: true, message: 'Training archived' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;