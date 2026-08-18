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

// PUT /api/rolemaster/designation — update just the Role Doc / JD links for
// an existing designation, identified by dept_id + desig_id rather than the
// Mongo _id (the /all list the frontend uses to pick a designation doesn't
// expose _id). Must be declared before PUT /:id so Express doesn't treat
// "designation" as an :id param.
router.put('/designation', async (req, res) => {
  try {
    const { dept_id, desig_id, role_document_link, jd_link } = req.body;
    if (dept_id === undefined || dept_id === null || desig_id === undefined || desig_id === null) {
      return res.status(400).json({ success: false, message: 'dept_id and desig_id are required' });
    }

    const doc = await RoleMaster.findOneAndUpdate(
      { dept_id: Number(dept_id), desig_id: Number(desig_id) },
      { $set: { role_document_link: (role_document_link || '').trim(), jd_link: (jd_link || '').trim() } },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Designation not found in Role Master' });
    }

    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
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