// routes/dept-targets.js
const express          = require('express');
const router           = express.Router();
const { DeptTargets }  = require('../models/pmsModels');

router.get('/', async (req, res) => {
  try {
    const filter = req.query.department ? { dept: req.query.department } : {};
    const data   = await DeptTargets.find(filter).sort({ dept: 1, name: 1 });
    console.log(`[dept-targets] ${data.length} records from collection: ${DeptTargets.collection.name}`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[dept-targets]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = await DeptTargets.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await DeptTargets.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await DeptTargets.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;