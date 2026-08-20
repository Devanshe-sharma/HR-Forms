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
//
// Goes through the RAW collection rather than the RoleMaster Mongoose model.
// Most role_master documents were imported long before the model existed and
// still carry capitalised legacy field names (Dept_Id/Desig_id/"JD Link"/
// etc — see roleMasterController's g()/gNum() helpers, which check both
// forms) instead of the model's lowercase schema paths (dept_id/desig_id/
// jd_link). A Mongoose query only ever matches the lowercase paths, so it
// silently misses the ~80% of documents still in the legacy shape. Matching
// on both id forms, and writing both field-name forms, keeps this working
// regardless of which shape a given document happens to be in.
router.put('/designation', async (req, res) => {
  try {
    const { dept_id, desig_id, role_document_link, jd_link } = req.body;
    if (dept_id === undefined || dept_id === null || desig_id === undefined || desig_id === null) {
      return res.status(400).json({ success: false, message: 'dept_id and desig_id are required' });
    }

    const deptIdNum  = Number(dept_id);
    const desigIdNum = Number(desig_id);
    const roleDocLinkTrimmed = (role_document_link || '').trim();
    const jdLinkTrimmed      = (jd_link || '').trim();

    // Driver v7's findOneAndUpdate returns the document directly (or null)
    // rather than the old {value: doc} wrapper — verified against this
    // project's actual mongodb driver version before relying on it.
    const doc = await RoleMaster.collection.findOneAndUpdate(
      {
        $or: [
          { dept_id: deptIdNum, desig_id: desigIdNum },
          { Dept_Id: deptIdNum, Desig_id: desigIdNum },
        ],
      },
      {
        $set: {
          role_document_link: roleDocLinkTrimmed,
          'Role Document Link': roleDocLinkTrimmed,
          jd_link: jdLinkTrimmed,
          'JD Link': jdLinkTrimmed,
        },
      },
      { returnDocument: 'after' }
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