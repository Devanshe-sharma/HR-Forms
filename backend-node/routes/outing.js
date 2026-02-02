const express = require('express');
const router = express.Router();
const Outing = require('../models/Outing');
const Employee = require('../models/Employee'); // if you have it
const sendEmail = require('../utils/sendEmail');

// 1. CREATE new outing proposal
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Fallbacks
    if (!data.topic) data.topic = 'Untitled Outing';
    if (!data.description) data.description = 'No description';

    data.proposedByRole = data.proposedByRole || 'HR';
    data.proposedByName = data.proposedByName || 'System';
    data.proposedAt = new Date();

    if (!data.status) {
      data.status = data.proposedByRole === 'Management' ? 'Proposed' : 'Under Review';
    }

    const outing = new Outing(data);
    const saved = await outing.save();

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. GET all outings (with filters)
router.get('/', async (req, res) => {
  try {
    const { status, quarter, financialYear, archived, outingName, limit = 20, page = 1 } = req.query;

    const filter = {};

    if (status) filter.status = { $in: status.split(',').map(s => s.trim()) };
    if (quarter) filter.quarter = quarter;
    if (financialYear) filter.financialYear = financialYear;
    if (outingName) filter.topic = { $regex: outingName, $options: 'i' };
    if (archived === 'true') filter.status = 'Archived';
    if (archived === 'false') filter.status = { $ne: 'Archived' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const outings = await Outing.find(filter)
      .sort({ tentativeDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Outing.countDocuments(filter);

    res.json({
      success: true,
      count: outings.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: outings,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET single outing
router.get('/:id', async (req, res) => {
  try {
    const outing = await Outing.findById(req.params.id);
    if (!outing) return res.status(404).json({ success: false, error: 'Outing not found' });
    res.json({ success: true, data: outing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. UPDATE outing (HR inline editing)
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Outing.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ success: false, error: 'Outing not found' });

    // Optional: if status changed to Completed → start 24-hour feedback window logic (cron or flag)
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. DELETE outing
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Outing.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Outing not found' });
    res.json({ success: true, message: 'Outing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. SUBMIT FEEDBACK (similar to training)
router.post('/:id/feedback', async (req, res) => {
  try {
    const outing = await Outing.findById(req.params.id);
    if (!outing) return res.status(404).json({ success: false, error: 'Outing not found' });

    // Check if feedback window is open (24 hours after start)
    const startTime = outing.tentativeDate;
    if (!startTime) return res.status(400).json({ success: false, error: 'No start date set' });

    const now = new Date();
    const hoursSinceStart = (now - startTime) / (1000 * 60 * 60);

    if (hoursSinceStart > 24) {
      return res.status(403).json({ success: false, error: 'Feedback window closed (24 hours only)' });
    }

    outing.feedbacks.push({
      employeeName: req.body.employeeName,
      department: req.body.department,
      designation: req.body.designation,
      attended: req.body.attended ?? false,
      overallRating: Number(req.body.overallRating),
      contentQuality: Number(req.body.contentQuality),
      whatWasMissing: req.body.whatWasMissing?.trim(),
      howHelpful: req.body.howHelpful?.trim(),
      submittedAt: now,
    });

    await outing.save();

    res.json({ success: true, message: 'Feedback submitted' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Management suggestion for new outing (similar to training)
router.post('/suggest', async (req, res) => {
  try {
    const data = req.body;

    data.proposedByRole = 'Management';
    data.status = 'Proposed';
    data.priority = data.priority || 'P3';

    const outing = new Outing(data);
    const saved = await outing.save();

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;