// routes/dept-kpi.js
const express     = require('express');
const router      = express.Router();
const { DeptKPI } = require('../models/pmsModels');

router.get('/', async (req, res) => {
  try {
    const filter = req.query.department ? { department: req.query.department } : {};
    
    // TEMP: bypass mongoose, query directly
    const raw = await DeptKPI.db.collection('deptKPIs').find({}).toArray();
    // console.log('[dept-kpi] RAW count:', raw.length, 'sample:', JSON.stringify(raw[0]?.name));
    
    const data = await DeptKPI.find(filter);
    // console.log('[dept-kpi] Mongoose count:', data.length, 'collection:', DeptKPI.collection.name);
    
    res.json({ success: true, data });
  } catch (err) {
    // console.error('[dept-kpi]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = await DeptKPI.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await DeptKPI.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await DeptKPI.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;