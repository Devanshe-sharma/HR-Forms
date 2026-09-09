const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const Department = require('../models/Departmentorientation');
const { requireRole } = require('../config/roles');
const { uploadFileToDrive, createDriveFolder } = require('../utils/googleDrive');
const { getEmployeeMasterList } = require('../utils/employeeMaster');

const DEPT_ORIENTATION_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_DEPT_ORIENTATION_PARENT_FOLDER_ID;

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

// Creates this department's root Drive folder on first use and caches its
// id on the document — every later upload for this department reuses it
// instead of creating a new folder each time. Mirrors the per-candidate
// folder pattern in routes/applicantRecords.js (send-offer-letter).
async function ensureDeptFolder(dept) {
  if (dept.driveFolderId) return dept.driveFolderId;
  const folder = await createDriveFolder(dept.name, DEPT_ORIENTATION_PARENT_FOLDER_ID);
  dept.driveFolderId = folder.id;
  await dept.save();
  return dept.driveFolderId;
}

// Creates a named subfolder (e.g. "Notes", "JD & Role Docs") inside the
// department's root folder on first use, caching its id on `dept[field]`.
async function ensureSubfolder(dept, field, subfolderName) {
  if (dept[field]) return dept[field];
  const rootId = await ensureDeptFolder(dept);
  const folder = await createDriveFolder(subfolderName, rootId);
  dept[field] = folder.id;
  await dept.save();
  return dept[field];
}

// Sourced from Onboarding (via the same getEmployeeMasterList() used by
// /onboarding/employee-master) rather than RoleMaster — the frontend's
// department list, and every dept-orientation save it makes, is keyed off
// Onboarding's `dept` field. RoleMaster's department names don't reliably
// match Onboarding's (e.g. "DAA" vs "Data Analytics and Automation"), so
// upserting DepartmentOrientation docs from RoleMaster's names left no
// matching record for departments as the frontend actually names them —
// dd.id came back empty and every save 404'd. Matching Onboarding here
// guarantees a record always exists for every department the UI shows.
async function getDistinctDepartmentNames() {
  const employees = await getEmployeeMasterList();
  return employees.filter(e => e.is_current).map(e => e.department);
}

// ── GET ALL ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const raw = await getDistinctDepartmentNames();

    const validNames = [...new Set(
      raw.map(n => n?.trim()).filter(Boolean)
    )].sort();

    if (!validNames.length) {
      console.warn('[dept-orientation] No distinct current department names found in Onboarding — check that employee-master returns data.');
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

      let docUrl;
      if (driveLink) {
        docUrl = driveLink;
      } else {
        const folderId = await ensureSubfolder(dept, 'roleDocsFolderId', 'JD & Role Docs');
        docUrl = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, folderId);
      }

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
    const { link, attachment, systemName } = req.body;
    const dept = await findDept(req.params.deptId);

    if (!dept) return res.status(404).json({ success: false });

    if (!dept.notes) dept.notes = []; // ✅ FIX

    const note = {
      id: uuidv4(),
      link: link || '',
      attachment: attachment || '',
      systemName: systemName || '',
      updatedAt: new Date().toLocaleDateString('en-IN')
    };

    dept.notes.push(note);
    await dept.save();

    res.json({ success: true, data: note });

  } catch (err) {
    console.error('Add note error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Uploads a note attachment straight to this department's "Notes" Drive
// subfolder and hands back its webViewLink — the frontend then saves
// that URL as `attachment` via POST /:deptId/notes above.
router.post('/:deptId/notes/upload', requireRole(['HR','Admin']), upload.single('file'), async (req, res) => {
  try {
    const dept = await findDept(req.params.deptId);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'File required' });

    const folderId = await ensureSubfolder(dept, 'notesFolderId', 'Notes');
    const url = await uploadFileToDrive(req.file.buffer, req.file.originalname, req.file.mimetype, folderId);

    res.json({ success: true, data: { url } });

  } catch (err) {
    console.error('Note upload error:', err);
    res.status(500).json({ success: false, message: err.message });
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