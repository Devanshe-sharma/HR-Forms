const express = require('express');
const router = express.Router();
const TrainingProposal = require('../models/TrainingProposal');
const Employee = require('../models/Employee');

// ────────────────────────────────────────────────
//  GET /api/training-proposals
//  List all proposals (optionally filter by status)
// ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const proposals = await TrainingProposal.find(filter)
      .sort({ createdAt: -1 }) // newest first
      .lean();

    res.json({ success: true, data: proposals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────
//  GET /api/training-proposals/:id
// ────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { date } = req.body;
    const updated = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { date }, // or { $set: { date } }
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────
//  POST /api/training-proposals
//  Create new training proposal
// ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const proposal = new TrainingProposal(req.body);
    await proposal.save();

    res.status(201).json({
      success: true,
      message: 'Training proposal submitted for approval',
      data: proposal,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────
//  PATCH /api/training-proposals/:id/approve
// ────────────────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
  try {
    const proposal = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved' },
      { new: true, runValidators: true }
    );

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    res.json({ success: true, message: 'Approved', data: proposal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────
//  PATCH /api/training-proposals/:id/reject
// ────────────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    const proposal = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected', reason: reason || '' },
      { new: true, runValidators: true }
    );

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    res.json({ success: true, message: 'Rejected', data: proposal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────
//  PATCH /api/training-proposals/:id/schedule
// ────────────────────────────────────────────────
router.patch('/:id/schedule', async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const proposal = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { status: 'Scheduled', date },
      { new: true, runValidators: true }
    );

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    res.json({ success: true, message: 'Scheduled', data: proposal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;