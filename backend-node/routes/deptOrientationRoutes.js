const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const Designation = require('../models/Designation');
const Department = require('../models/Departmentorientation');   // ← Restored
const { requireRole } = require('../config/roles');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
    const fileExt = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, JPG, JPEG, PNG allowed.'));
    }
  }
});

// ── Helper ────────────────────────────────────────────────────
async function findDept(nameOrId) {
  let doc = await Department.findOne({ department: nameOrId }); 
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
          { department: name },                    // ← use department field
          { $setOnInsert: { department: name } },  // ← use department field
          { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
        )
      )
    );

    const data = results
      .filter(Boolean)
      .map(doc => ({
        ...doc,
        id: doc._id?.toString() || '',
        name: doc.department,   // ← map department field to name for frontend
      }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /dept-orientation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/test-upload', (req, res) => {
  res.json({ message: 'Upload route working!' });
});

// ── UPLOAD DESIGNATION DOCUMENTS (JD & Role Docs) ───────────────────────────────────────
router.post(
  '/upload-designation-doc',
  requireRole(['HR', 'Admin']),
  upload.single('file'),  
  async (req, res) => {
  try {
    const { department, designation, type, systemName, driveLink } = req.body;
    const file = req.file;

    console.log('🔄 Upload request received:', { 
      department, 
      designation, 
      type, 
      systemName, 
      driveLink, 
      hasFile: !!file,
      userRole: req.headers['x-user-role'],
      authorization: req.headers.authorization ? 'present' : 'missing'
    });

    if (!department || !designation || !type || !systemName) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        message: 'department, designation, type, and systemName required' 
      });
    }

    if (!file && !driveLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either file or driveLink is required' 
      });
    }

    // Find department
    const dept = await findDept(department);
    if (!dept) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }

    // Create document URL (for file uploads, you'd need to implement file storage)
    const docUrl = driveLink || (file ? `/uploads/${file.originalname}` : '');

    // Create new role document
    const newRoleDoc = {
      id: uuidv4(),
      role: designation,
      jdUrl: type === 'jd' ? docUrl : dept.roleDocs?.find(doc => doc.role === designation)?.jdUrl || '',
      roleDocUrl: type === 'role' ? docUrl : dept.roleDocs?.find(doc => doc.role === designation)?.roleDocUrl || '',
    };

    // Find existing role doc for this designation or add new one
    const existingDocIndex = dept.roleDocs.findIndex(doc => doc.role === designation);
    
    if (existingDocIndex >= 0) {
      // Update existing document
      if (type === 'jd') {
        dept.roleDocs[existingDocIndex].jdUrl = docUrl;
      } else {
        dept.roleDocs[existingDocIndex].roleDocUrl = docUrl;
      }
    } else {
      // Add new role document
      dept.roleDocs.push(newRoleDoc);
    }

    await dept.save();

    res.json({ 
      success: true, 
      message: `${type === 'jd' ? 'JD' : 'Role document'} uploaded successfully`,
      data: type === 'jd' ? newRoleDoc.jdUrl : newRoleDoc.roleDocUrl
    });

  } catch (err) {
    console.error('Upload designation doc error:', err.message);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});


// ── ONBOARDING PPT ────────────────────────────────────────────
router.put('/:deptName/onboarding-ppt', requireRole(['HR', 'Admin']), async (req, res) => {
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
router.put('/:deptName/master-ppt', requireRole(['HR', 'Admin']), async (req, res) => {
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
router.post('/:deptId/review-ppts', requireRole(['HR', 'Admin']), async (req, res) => {
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

router.delete('/:deptId/review-ppts/:pptId', requireRole(['HR', 'Admin']), async (req, res) => {
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
router.post('/:deptId/notes', requireRole(['HR', 'Admin']), async (req, res) => {
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

router.delete('/:deptId/notes/:noteId', requireRole(['HR', 'Admin']), async (req, res) => {
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
router.put('/:deptId/tests/recruitment', requireRole(['HR', 'Admin']), async (req, res) => {
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

router.put('/:deptId/tests/onboarding', requireRole(['HR', 'Admin']), async (req, res) => {
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