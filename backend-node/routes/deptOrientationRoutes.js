const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const Department = require('../models/Departmentorientation');
const RoleMaster = require('../models/role_master');
const { requireRole } = require('../config/roles');

// ── MULTER CONFIG ─────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// ── HELPER ────────────────────────────────────────────────────
async function findDept(nameOrId) {
  let doc = await Department.findOne({ name: nameOrId }); // ✅ FIXED

  if (!doc && /^[a-f\d]{24}$/i.test(nameOrId)) {
    doc = await Department.findById(nameOrId);
  }

  return doc;
}

// This codebase's RoleMaster collection has a known history of field-name
// casing inconsistency (some code paths write/read "Department", others
// "department") — see the earlier reportingHead/empId backfill routes,
// which had to work around the exact same ambiguity by using the raw
// driver. Rather than guessing which casing is currently correct (and
// silently returning zero departments if we guess wrong, which is what
// was happening here — .distinct() only matches an EXACT field name),
// this queries both and merges the results.
async function getDistinctDepartmentNames() {
  const [pascal, lower] = await Promise.all([
    RoleMaster.distinct('Department', { Department: { $ne: '' } }).catch(() => []),
    RoleMaster.distinct('department', { department: { $ne: '' } }).catch(() => []),
  ]);
  return [...pascal, ...lower];
}

// ── GET ALL ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const raw = await getDistinctDepartmentNames();

    const validNames = [...new Set(
      raw.map(n => n?.trim()).filter(Boolean)
    )].sort();

    if (!validNames.length) {
      console.warn('[dept-orientation] No distinct department names found in RoleMaster under either "Department" or "department" — check the actual field name on the collection.');
      return res.json({ success: true, data: [] });
    }

    const results = await Promise.all(
      validNames.map(async (name) => {
        try {
          return await Department.findOneAndUpdate(
            { name },
            { $setOnInsert: { name } },
            { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
          );
        } catch (e) {
          console.error('Upsert failed:', name, e);
          return null;
        }
      })
    );

    const data = results
      .filter(Boolean)
      .map(doc => ({
        ...doc,
        id: doc._id?.toString() || '',
        name: doc.name,
      }));

    res.json({ success: true, data });

  } catch (err) {
    console.error('GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── TEST ──────────────────────────────────────────────────────
router.get('/test-upload', (req, res) => {
  res.json({ message: 'Upload route working!' });
});

// ── UPLOAD JD / ROLE DOC ──────────────────────────────────────
router.post(
  '/upload-designation-doc',
  requireRole(['HR', 'Admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      const { department, designation, type, systemName, driveLink } = req.body;
      const file = req.file;

      if (!department || !designation || !type || !systemName) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
      }

      if (!file && !driveLink) {
        return res.status(400).json({ success: false, message: 'File or link required' });
      }

      const dept = await findDept(department);
      if (!dept) {
        return res.status(404).json({ success: false, message: 'Department not found' });
      }

      // ✅ ensure arrays exist
      if (!dept.roleDocs) dept.roleDocs = [];

      const docUrl = driveLink || `/uploads/${file.originalname}`;

      const existingIndex = dept.roleDocs.findIndex(d => d.role === designation);

      if (existingIndex >= 0) {
        if (type === 'jd') {
          dept.roleDocs[existingIndex].jdUrl = docUrl;
        } else {
          dept.roleDocs[existingIndex].roleDocUrl = docUrl;
        }
      } else {
        dept.roleDocs.push({
          id: uuidv4(),
          role: designation,
          jdUrl: type === 'jd' ? docUrl : '',
          roleDocUrl: type === 'role_doc' ? docUrl : '' // ✅ FIXED
        });
      }

      await dept.save();

      res.json({
        success: true,
        data: docUrl
      });

    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── ONBOARDING PPT ────────────────────────────────────────────
router.put('/:deptName/onboarding-ppt', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const { name, url } = req.body;
    const dept = await findDept(req.params.deptName);

    if (!dept) return res.status(404).json({ success: false });

    dept.onboardingPPT = { id: 'ppt', name: name || '', url };
    await dept.save();

    res.json({ success: true, data: dept.onboardingPPT });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── MASTER PPT ────────────────────────────────────────────────
router.put('/:deptName/master-ppt', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const { name, url } = req.body;
    const dept = await findDept(req.params.deptName);

    if (!dept) return res.status(404).json({ success: false });

    dept.masterPPT = { id: 'master', name: name || '', url };
    await dept.save();

    res.json({ success: true, data: dept.masterPPT });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REVIEW PPTs ───────────────────────────────────────────────
router.post('/:deptId/review-ppts', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const { fy, quarter, name, url } = req.body;
    const dept = await findDept(req.params.deptId);

    if (!dept) return res.status(404).json({ success: false });

    if (!dept.reviewPPTs) dept.reviewPPTs = []; // ✅ FIX

    const newPPT = { id: uuidv4(), fy, quarter, name, url };
    dept.reviewPPTs.push(newPPT);

    await dept.save();

    res.json({ success: true, data: newPPT });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:deptId/review-ppts/:pptId', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false });

    dept.reviewPPTs = (dept.reviewPPTs || []).filter(p => p.id !== req.params.pptId);

    await dept.save();
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ── NOTES ─────────────────────────────────────────────────────
router.post('/:deptId/notes', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const { title, content } = req.body;
    const dept = await findDept(req.params.deptId);

    if (!dept) return res.status(404).json({ success: false });

    if (!dept.notes) dept.notes = []; // ✅ FIX

    const note = {
      id: uuidv4(),
      title,
      content,
      updatedAt: new Date().toLocaleDateString('en-IN')
    };

    dept.notes.push(note);
    await dept.save();

    res.json({ success: true, data: note });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/:deptId/notes/:noteId', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false });

    dept.notes = (dept.notes || []).filter(n => n.id !== req.params.noteId);

    await dept.save();
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ── TESTS ─────────────────────────────────────────────────────
router.put('/:deptId/tests/recruitment', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false });

    dept.recruitmentTest = req.body;
    await dept.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.put('/:deptId/tests/onboarding', requireRole(['HR','Admin']), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false });

    dept.onboardingTest = req.body;
    await dept.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;