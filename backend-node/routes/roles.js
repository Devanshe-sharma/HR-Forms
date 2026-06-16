const express = require('express');
const router = express.Router();

const RoleMaster = require('../models/role_master');

const {
  getRoles,
  getAllFormData,
} = require('../controllers/roleMasterController');

// GET /api/role-master
router.get('/', async (req, res) => {
  try {
    const data = await RoleMaster.find()
      .sort({ dept_id: 1, desig_id: 1 })
      .lean();

    res.json(data);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// GET /api/role-master/all
router.get('/all', getAllFormData);

// POST
router.post('/', async (req, res) => {
  try {
    const doc = await RoleMaster.create(req.body);

    res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message,
    });
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const doc = await RoleMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({
      success: true,
      data: doc,
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message,
    });
  }
});

module.exports = router;