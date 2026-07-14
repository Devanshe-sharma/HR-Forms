// routes/candidateApplications.js
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const router  = express.Router();
const CandidateApplication = require('../models/Candidateapplication');
const ApplicantRecord      = require('../models/ApplicantRecord');
const { triggerCandidateApplication } = require('../emails');

// ─── Resume upload ──────────────────────────────────────────────────────────
// Stored on local disk under uploads/resumes — make sure index.js serves
// this directory statically:
//   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// If this app already uploads files elsewhere via a different storage
// backend (e.g. Google Drive — this project's .env has Google service
// account credentials, used for Dept Orientation's own upload dialog),
// swap this multer.diskStorage for whatever that same mechanism is,
// instead of introducing a second, inconsistent storage location.
const RESUME_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(RESUME_UPLOAD_DIR)) fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RESUME_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for the resume'));
  },
});

const FIELDS_TO_COPY = [
  'full_name', 'email', 'phone', 'whatsapp_same', 'dob',
  'country', 'state', 'city', 'pin_code', 'relocation',
  'designation', 'designation_id', 'highest_qualification',
  'experience', 'total_experience', 'current_ctc', 'notice_period',
  'expected_monthly_ctc',
  'hindi_read', 'hindi_write', 'hindi_speak',
  'english_read', 'english_write', 'english_speak',
  'facebookLink', 'linkedin', 'short_video_url',
  'resume',
];

// POST /api/candidate-applications  — submit form
// The frontend now sends multipart/form-data (FormData with the resume
// file attached under the field name "resume"), not JSON — multer parses
// the other fields into req.body as strings and hands the file separately
// via req.file. This single route handles both the file and the rest of
// the form together, so a resume upload can never succeed while the
// surrounding application silently fails (or vice versa).
router.post('/', uploadResume.single('resume'), async (req, res) => {
  try {
    const resumePath = req.file ? `/uploads/resumes/${req.file.filename}` : '';

    const doc = await CandidateApplication.create({
      ...req.body,
      resume: resumePath,
    });

    // Seed an ApplicantRecord for the HR dashboard (fire-and-forget)
    const recordPayload = { applicationRef: doc._id };
    for (const field of FIELDS_TO_COPY) {
      recordPayload[field] = doc[field] ?? '';
    }
    ApplicantRecord.create(recordPayload).catch((e) =>
      console.error('[ApplicantRecord seed] failed:', e.message),
    );

    // Send confirmation + HR notification emails (fire-and-forget)
    triggerCandidateApplication(doc);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    // If multer's fileFilter rejected the upload (wrong file type) or the
    // file exceeded the size limit, err.message already describes exactly
    // why — surfaced as-is rather than a generic failure.
    console.error('Candidate application error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/candidate-applications  — dashboard list
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, status, search, designation } = req.query;

    const filter = {};
    if (status)      filter.status      = status;
    if (designation) filter.designation = designation;
    if (search) {
      filter.$or = [
        { full_name:   { $regex: search, $options: 'i' } },
        { email:       { $regex: search, $options: 'i' } },
        { phone:       { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      CandidateApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      CandidateApplication.countDocuments(filter),
    ]);

    res.json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/candidate-applications/:id  — single record
router.get('/:id', async (req, res) => {
  try {
    const doc = await CandidateApplication.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/candidate-applications/:id/status  — status-only update from table row
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const doc = await CandidateApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/candidate-applications/:id  — full update from modal
router.patch('/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, ...updates } = req.body;

    const doc = await CandidateApplication.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;