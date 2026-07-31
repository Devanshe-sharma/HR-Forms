// routes/candidateApplications.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const CandidateApplication = require('../models/Candidateapplication');
const ApplicantRecord      = require('../models/ApplicantRecord');
const { triggerCandidateApplication } = require('../emails');
const { uploadResumeToDrive } = require('../utils/googleDrive');

// Memory storage — no local disk write at all. The file buffer goes
// straight to Google Drive via uploadResumeToDrive() inside the route
// handler below, instead of ever touching this server's filesystem.
const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for the resume'));
  },
});

const FIELDS_TO_COPY = [
  'full_name', 'email', 'phone', 'whatsapp_same', 'whatsappNumber', 'dob',
  'country', 'state', 'city', 'pin_code', 'relocation',
  'job_id', 'designation', 'designation_id', 'candidateType',
  'highest_qualification', 'educationSpecialization', 'collegeUniversity', 'graduationYear',
  'courseName', 'semesterOrYear', 'internshipDuration',
  'total_experience', 'relevantExperience', 'current_company', 'current_designation',
  'current_ctc', 'expected_annual_ctc', 'notice_period', 'expectedJoiningDate',
  'primarySkills', 'secondarySkills', 'languagesKnown', 'otherLanguage',
  'linkedin', 'githubPortfolio', 'short_video_url', 'preferredWorkMode',
  'candidateSource', 'sourceDetail',
  'resume',
];

// Fields that arrive as JSON-stringified text because the request is
// multipart/form-data (required for the resume file) rather than JSON —
// multipart has no native way to carry arrays/objects, so the frontend
// stringifies these specific fields and this parses them back.
const JSON_FIELDS = ['primarySkills', 'secondarySkills', 'languagesKnown', 'screeningAnswers'];

router.post('/', uploadResume.single('resume'), async (req, res) => {
  try {
    // Resume is mandatory — the frontend already blocks submission
    // without one, but that's only client-side; this is the real,
    // enforced check, since a direct API call could otherwise bypass
    // the frontend entirely and still create a resume-less record.
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume is required.' });
    }

    const body = { ...req.body };
    for (const field of JSON_FIELDS) {
      if (typeof body[field] === 'string' && body[field]) {
        try {
          body[field] = JSON.parse(body[field]);
        } catch {
          return res.status(400).json({ success: false, message: `Invalid ${field} payload.` });
        }
      }
    }

    // Upload to Drive first — resume ends up as a real, publicly-viewable
    // Drive link (see uploadResumeToDrive's own comments for exactly how
    // that permission gets set), not a local disk path.
    const resumeLink = await uploadResumeToDrive(req.file.buffer, req.file.originalname, req.file.mimetype);

    const doc = await CandidateApplication.create({
      ...body,
      resume: resumeLink,
      consentTimestamp: body.consentGiven ? new Date() : null,
    });

    // Seed an ApplicantRecord for the HR dashboard (fire-and-forget)
    const recordPayload = { applicationRef: doc._id };
    for (const field of FIELDS_TO_COPY) {
      recordPayload[field] = doc[field] ?? '';
    }
    // Compatibility mapping onto the two dashboard fields the candidate is
    // no longer asked directly — derived here, once, rather than duplicated
    // as a second candidate-facing question.
    recordPayload.experience = doc.candidateType === 'Fresher' ? 'No' : 'Yes';
    recordPayload.expected_monthly_ctc = doc.expected_annual_ctc ?? '';

    ApplicantRecord.create(recordPayload).catch((e) =>
      console.error('[ApplicantRecord seed] failed:', e.message),
    );

    // Send confirmation + HR notification emails (fire-and-forget)
    triggerCandidateApplication(doc);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    // Same email + job_id already exists (unique index on the model) —
    // a friendlier message than the raw duplicate-key error.
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already applied for this position.' });
    }
    // If multer's fileFilter rejected the upload (wrong file type), the
    // file exceeded the size limit, or the Drive upload itself failed
    // (e.g. missing/invalid credentials), err.message already describes
    // exactly why — surfaced as-is rather than a generic failure.
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