const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Designation = require('../models/Designation');
const Department = require('../models/Department');   // ← THIS WAS MISSING
const { requireRole } = require('../config/roles');

// ── Helper ────────────────────────────────────────────────────
async function findDept(nameOrId) {
  let doc = await Department.findOne({ name: nameOrId });
  if (!doc && nameOrId.match(/^[a-f\d]{24}$/i)) {
    doc = await Department.findById(nameOrId);
  }
  return doc;
}

// GET /api/dept-orientation
router.get('/', async (req, res) => {
  try {
    const raw = await Designation.distinct('department');
    const validNames = [...new Set(raw.map(n => n?.trim()).filter(Boolean))].sort();

    if (validNames.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const results = await Promise.all(
      validNames.map(name =>
        Department.findOneAndUpdate(
          { name },
          { $setOnInsert: { name } },
          { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
        )
      )
    );

    const data = results
      .filter(Boolean)
      .map(doc => ({
        ...doc,
        id: doc._id?.toString() || '',
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /dept-orientation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ONBOARDING PPT ────────────────────────────────────────────
router.put('/:deptName/onboarding-ppt', requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    const dept = await findDept(req.params.deptName);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.onboardingPPT = { id: 'ppt', name: name || '', url };
    await dept.save();
    res.json({ success: true, data: dept.onboardingPPT });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── MASTER PPT ────────────────────────────────────────────────
router.put('/:deptName/master-ppt', requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    const dept = await findDept(req.params.deptName);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.masterPPT = { id: 'master', name: name || '', url };
    await dept.save();
    res.json({ success: true, data: dept.masterPPT });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REVIEW PPTs ───────────────────────────────────────────────
router.post('/:deptId/review-ppts', requireRole('hr'), async (req, res) => {
  try {
    const { fy, quarter, name, url } = req.body;
    if (!fy || !quarter || !name || !url)
      return res.status(400).json({ success: false, message: 'fy, quarter, name and url required' });
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    const newPPT = { id: uuidv4(), fy, quarter, name, url };
    dept.reviewPPTs.push(newPPT);
    await dept.save();
    res.status(201).json({ success: true, data: newPPT });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:deptId/review-ppts/:pptId', requireRole('hr'), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.reviewPPTs = dept.reviewPPTs.filter(p => p.id !== req.params.pptId);
    await dept.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── NOTES ─────────────────────────────────────────────────────
router.post('/:deptId/notes', requireRole('hr'), async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content)
      return res.status(400).json({ success: false, message: 'Title and content required' });
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    const newNote = {
      id: uuidv4(), title, content,
      updatedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
    dept.notes.push(newNote);
    await dept.save();
    res.status(201).json({ success: true, data: newNote });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:deptId/notes/:noteId', requireRole('hr'), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.notes = dept.notes.filter(n => n.id !== req.params.noteId);
    await dept.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── TESTS ─────────────────────────────────────────────────────
router.put('/:deptId/tests/recruitment', requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.recruitmentTest = { id: 'rec', name: name || '', url };
    await dept.save();
    res.json({ success: true, data: dept.recruitmentTest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:deptId/tests/onboarding', requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL required' });
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    dept.onboardingTest = { id: 'onb', name: name || '', url };
    await dept.save();
    res.json({ success: true, data: dept.onboardingTest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;