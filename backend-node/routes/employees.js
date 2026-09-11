// routes/employees.js
// CRITICAL: lightweight mode MUST return _id so dashboard can match
// hygienes.employeeId / growths.employeeId / rolekpis.employeeId
// All three collections store the Employee MongoDB _id as their employeeId field

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const Employee = require('../models/Employee');
const { authenticate } = require('../middleware/authenticate');
const { uploadFileToDrive, createDriveFolder } = require('../utils/googleDrive');
const EMPLOYEE_DOCUMENT_TYPES = require('../utils/employeeDocumentTypes');

// Self-service writes (personal-info edits, document uploads) are only ever
// meant to touch the requesting user's own Employee record — an Admin/HR
// account can still reach any record (e.g. to fix a typo on someone's
// behalf), but anyone else must own it (matched by their login email
// against official_email/personal_email) or gets a 403.
function canManageEmployeeRecord(user, employee) {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'HR') return true;
  const email = (user.email || '').trim().toLowerCase();
  if (!email) return false;
  return (
    (employee.official_email || '').trim().toLowerCase() === email ||
    (employee.personal_email || '').trim().toLowerCase() === email
  );
}

router.get('/', async (req, res) => {
  try {
    if (req.query.email) {
      const email = String(req.query.email).trim();
      const employees = await Employee.find({
        isArchived: { $ne: true },
        $or: [
          { official_email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { personal_email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
      });
      return res.json({ success: true, data: employees });
    }

    if (req.query.lightweight === 'true') {
      const employees = await Employee.find({ isArchived: { $ne: true } })
        .select('_id full_name department designation official_email score')
        .sort({ full_name: 1 })
        .lean();

      const formatted = employees.map(emp => ({
        _id:         emp._id,               // ObjectId — used to match employeeId in hygienes/growths/rolekpis
        name:        emp.full_name    || '',
        department:  emp.department   || '',
        designation: emp.designation  || '',
        email:       emp.official_email || String(emp._id), // unique React key
        score:       emp.score        || 0,
      }));

      return res.json({ success: true, data: formatted });
    }

    const employees = await Employee.find({ isArchived: { $ne: true } });
    return res.json({ success: true, data: employees });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/review-period - Get employees eligible for performance review
router.get('/review-period', async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const employees = await Employee.find({
      joining_date: { $gte: sixMonthsAgo, $lte: now }
    })
    .select('_id employee_id full_name department designation joining_date level official_email')
    .sort({ full_name: 1 })
    .lean();

    const formatted = employees.map(emp => ({
      _id: emp._id,
      employee_id: emp.employee_id || '',
      name: emp.full_name || '',
      department: emp.department || '',
      designation: emp.designation || '',
      email: emp.official_email || '',
      joining_date: emp.joining_date || '',
      level: emp.level || 1,
      months_in_service: Math.max(0, Math.floor((now - new Date(emp.joining_date)) / (1000 * 60 * 60 * 24 * 30))),
      review_status: 'pending'
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching review period employees:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/employees/archived - Get archived employees
router.get('/archived', async (req, res) => {
  try {
    const employees = await Employee.find({ isArchived: true })
      .sort({ archivedAt: -1 });
    return res.json({ success: true, data: employees });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/personal-info - Self-service update of Profile page
// personal info fields only. Scoped to an allowlist so this can never be used
// to touch HR-managed fields (salary, department, designation, etc.).
const PERSONAL_INFO_FIELDS = [
  'citizenship', 'nationality', 'passportNo', 'passportValidUpto', 'passportIssuePlace',
  'bankName', 'bankAccountNo', 'ifscCode', 'panCard', 'aadhaarNo', 'uanNo', 'ePassbookLink',
  'birthday', 'bloodGroup', 'maritalStatus',
  'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'emergencyContactPlace',
  'familyFather', 'familyMother', 'familySiblings', 'familySpouse', 'familyChildren',
];

router.put('/:id/personal-info', authenticate, async (req, res) => {
  try {
    const existing = await Employee.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (!canManageEmployeeRecord(req.user, existing)) {
      return res.status(403).json({ success: false, error: 'You can only edit your own personal info' });
    }

    const update = {};
    for (const key of PERSONAL_INFO_FIELDS) {
      if (key in req.body) update[key] = req.body[key];
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error updating personal info:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/employees/:id/upload-documents - Self-service document upload
// from the Profile page's "Financial & Documents" tab. One file per
// request, keyed by `docType` (validated against EMPLOYEE_DOCUMENT_TYPES).
// Files never touch local disk (multer memoryStorage) — they're streamed
// straight to this employee's own Drive subfolder (created lazily, on
// first upload) and only the resulting link is persisted. Re-uploading the
// same docType appends a new entry rather than replacing the old one; the
// frontend shows the most recent entry per docType.
const uploadEmployeeDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Invalid file type — use PDF, Word, or an image.'));
  },
}).single('file');

router.post('/:id/upload-documents', authenticate, uploadEmployeeDoc, async (req, res) => {
  try {
    const docType = req.body.docType;
    if (!EMPLOYEE_DOCUMENT_TYPES.some((d) => d.key === docType)) {
      return res.status(400).json({ success: false, error: 'Unknown document type' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was selected' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (!canManageEmployeeRecord(req.user, employee)) {
      return res.status(403).json({ success: false, error: 'You can only upload documents for your own profile' });
    }

    if (!employee.documentsUploadFolderId) {
      const parentFolderId = process.env.GOOGLE_DRIVE_EMPLOYEE_DOCS_PARENT_FOLDER_ID || process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;
      const folder = await createDriveFolder(`${employee.full_name || 'Employee'} - ${employee._id}`, parentFolderId);
      employee.documentsUploadFolderId = folder.id;
      employee.documentsUploadFolderLink = folder.webViewLink;
    }

    // makePublic: false — these are personal documents (Aadhaar/PAN,
    // marksheets), kept restricted to this Shared Drive's members rather
    // than "anyone with the link".
    const driveLink = await uploadFileToDrive(
      req.file.buffer, req.file.originalname, req.file.mimetype,
      employee.documentsUploadFolderId, { makePublic: false }
    );
    employee.documents.push({
      docType,
      fileName: req.file.originalname,
      driveLink,
      uploadedAt: new Date(),
    });

    await employee.save();
    return res.json({ success: true, data: employee.documents });
  } catch (err) {
    console.error('Error uploading employee document:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/archive - Archive an employee
router.put('/:id/archive', async (req, res) => {
  try {
    console.log(`Archiving employee with ID: ${req.params.id}`);
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { 
        isArchived: true,
        archivedAt: new Date()
      },
      { new: true }
    );
    
    if (!employee) {
      console.log(`Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    
    console.log(`Successfully archived employee: ${employee.full_name} (${employee.employee_id})`);
    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error archiving employee:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id/unarchive - Unarchive an employee
router.put('/:id/unarchive', async (req, res) => {
  try {
    console.log(`Unarchiving employee with ID: ${req.params.id}`);
    
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { 
        isArchived: false,
        archivedAt: null
      },
      { new: true }
    );
    
    if (!employee) {
      console.log(`Employee not found with ID: ${req.params.id}`);
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    
    console.log(`Successfully unarchived employee: ${employee.full_name} (${employee.employee_id})`);
    return res.json({ success: true, data: employee });
  } catch (err) {
    console.error('Error unarchiving employee:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;