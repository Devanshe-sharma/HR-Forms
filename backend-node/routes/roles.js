const express = require('express');
const router = express.Router();

const RoleMaster = require('../models/role_master');
const Onboarding = require('../models/onboardingModel');

const {
  getRoles,
  getAllFormData,
} = require('../controllers/roleMasterController');

// Pushes a Role Master row's current department/designation text down onto
// Onboarding records — called after any edit that could have changed
// department or designation names, so a rename here actually shows up in
// Employee List / Profile / Onboarding instead of staying a stale snapshot
// forever. Two ways a record gets reached, since most records were never
// linked by the backfill (see POST /onboarding/backfill-dept-desig-ids —
// most existing employees' dept/designation combo isn't in the Master at
// all yet, so there was nothing to link them to):
//   1. ID-linked — dept_id/desig_id match this row exactly. Most precise;
//      survives even if the OLD text was already wrong/inconsistent.
//   2. Text fallback — no ID link required at all. If this edit actually
//      changed the department/designation text, every record still
//      holding the OLD text gets moved to the new text. `before` is the
//      row as it was immediately before this update, so "old text" always
//      means what was really there a moment ago, not a guess.
async function cascadeRoleMasterEdit(doc, before) {
  if (!doc) return;

  if (doc.dept_id != null) {
    await Onboarding.updateMany(
      { dept_id: doc.dept_id },
      { $set: { dept: doc.department, deptLink: doc.dept_page_link || '' } }
    );
  }
  if (doc.dept_id != null && doc.desig_id != null) {
    await Onboarding.updateMany(
      { dept_id: doc.dept_id, desig_id: doc.desig_id },
      { $set: { designation: doc.designation, designationLink: doc.role_document_link || '' } }
    );
  }

  if (before?.department && doc.department && before.department !== doc.department) {
    await Onboarding.updateMany(
      { dept: before.department },
      { $set: { dept: doc.department, deptLink: doc.dept_page_link || '' } }
    );
  }
  // Scoped to the (new) department too — a bare designation title like
  // "Manager" can exist under several departments, and without this a
  // rename in one department could wrongly relabel someone in another.
  if (before?.designation && doc.designation && before.designation !== doc.designation) {
    await Onboarding.updateMany(
      { dept: doc.department, designation: before.designation },
      { $set: { designation: doc.designation, designationLink: doc.role_document_link || '' } }
    );
  }
}

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

    await Onboarding.updateMany(
      { dept_id: deptIdNum, desig_id: desigIdNum },
      { $set: { designationLink: roleDocLinkTrimmed } }
    );

    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const before = await RoleMaster.findById(req.params.id).lean();
    const doc = await RoleMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    await cascadeRoleMasterEdit(doc, before);

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