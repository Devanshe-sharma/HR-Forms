// routes/requiredScoreByLevel.js — required score per level (1, 2, 3)
const express = require('express');
const router = express.Router();
const RequiredScoreByLevel = require('../models/RequiredScoreByLevel');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET all (level → requiredScore)
router.get('/', asyncHandler(async (req, res) => {
  const list = await RequiredScoreByLevel.find().sort({ level: 1 }).lean();
  res.json({ success: true, data: list });
}));

// GET by level (e.g. ?level=1)
router.get('/by-level/:level', asyncHandler(async (req, res) => {
  const level = Number(req.params.level);
  if (![1, 2, 3].includes(level)) {
    return res.status(400).json({ success: false, error: 'Level must be 1, 2, or 3' });
  }
  let doc = await RequiredScoreByLevel.findOne({ level }).lean();
  if (!doc) {
    // Defaults if not in DB
    const defaults = { 1: 70, 2: 75, 3: 80 };
    doc = { level, requiredScore: defaults[level] };
  }
  res.json({ success: true, data: doc });
}));

// POST/PUT — set required score for a level (admin)
router.post('/', asyncHandler(async (req, res) => {
  const { level, requiredScore } = req.body || {};
  if (![1, 2, 3].includes(Number(level))) {
    return res.status(400).json({ success: false, error: 'Level must be 1, 2, or 3' });
  }
  const score = Math.min(100, Math.max(0, Number(requiredScore) || 70));
  const doc = await RequiredScoreByLevel.findOneAndUpdate(
    { level: Number(level) },
    { requiredScore: score },
    { new: true, upsert: true }
  );
  res.json({ success: true, data: doc });
}));

module.exports = router;
