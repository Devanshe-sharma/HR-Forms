const express = require('express');
const router = express.Router();
const CtcComponent = require('../models/CtcComponent');

// GET all active components (what frontend uses)
router.get('/', async (req, res) => {
  try {
    const components = await CtcComponent.find({ is_active: true })
      .sort({ order: 1, name: 1 })
      .select('-__v -created_at -updated_at'); // clean response

    res.json(components);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET all (including inactive) – useful for admin
router.get('/all', async (req, res) => {
  try {
    const components = await CtcComponent.find().sort({ order: 1, name: 1 });
    res.json(components);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single by code or ID
router.get('/:id', async (req, res) => {
  try {
    const component = await CtcComponent.findById(req.params.id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.json(component);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST – create new component
router.post('/', async (req, res) => {
  try {
    const newComponent = new CtcComponent(req.body);
    await newComponent.save();
    res.status(201).json(newComponent);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Code must be unique' });
    }
    res.status(400).json({ message: 'Invalid data', error: err.message });
  }
});

// PATCH – update component
router.patch('/:id', async (req, res) => {
  try {
    const component = await CtcComponent.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!component) return res.status(404).json({ message: 'Not found' });
    res.json(component);
  } catch (err) {
    res.status(400).json({ message: 'Update failed', error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const component = await CtcComponent.findByIdAndDelete(req.params.id);
    if (!component) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;