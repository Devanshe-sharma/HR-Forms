// routes/candidateApplications.js
const express = require('express');
const router  = express.Router();
const CandidateApplication = require('../models/CandidateApplication');

// POST /api/candidate-applications  — submit form
router.post('/', async (req, res) => {
  try {
    const doc = await CandidateApplication.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('Candidate application error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/candidate-applications  — dashboard list
// ?page=1&limit=20&status=New&search=john
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, designation } = req.query;

    const filter = {};
    if (status)      filter.status      = status;
    if (designation) filter.designation = designation;
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { phone:     { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      CandidateApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      CandidateApplication.countDocuments(filter),
    ]);

    res.json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/candidate-applications/:id  — single record
router.get('/:id', async (req, res) => {
  try {
    const doc = await CandidateApplication.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/candidate-applications/:id/status  — update status from dashboard
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const doc = await CandidateApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;