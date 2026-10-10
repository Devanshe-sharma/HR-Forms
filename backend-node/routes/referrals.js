// routes/referrals.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const Referral           = require('../models/Referral');
const HiringRequisition  = require('../models/HiringRequisition');
const ApplicantRecord    = require('../models/ApplicantRecord');
const { uploadResumeToDrive } = require('../utils/googleDrive');
const { triggerReferralSubmitted } = require('../emails');
const { authenticate } = require('../middleware/authenticate');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same shape as routes/candidateApplications.js — memory storage only,
// buffer goes straight to Google Drive, never touches local disk.
const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for the resume'));
  },
});

// POST /api/referrals — the referrer must be logged in (reached via the
// employee referral page after authentication, not a public email link);
// referrerName/referrerEmail come from the authenticated session, never
// from form input, so a referral can't be submitted under someone else's
// name.
router.post('/', authenticate, uploadResume.single('resume'), async (req, res) => {
  try {
    const { requisitionId, candidateName, candidatePhone, candidateEmail, relationship, confirmDuplicate } = req.body;
    const referrerName  = req.user.name;
    const referrerEmail = req.user.email;

    if (!requisitionId || !candidateName || !candidatePhone || !candidateEmail) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Candidate's resume is required." });
    }

    const requisition = await HiringRequisition.findById(requisitionId);
    if (!requisition) {
      return res.status(404).json({ success: false, message: 'This position could not be found.' });
    }
    if (requisition.fmsStatus !== 'Open') {
      return res.status(400).json({ success: false, message: 'This position is no longer open for referrals.' });
    }

    // Duplicate-candidate check against existing ApplicantRecord profiles —
    // same convention as routes/candidateApplications.js.
    if (!confirmDuplicate) {
      const dupOr = [];
      if (candidateEmail) dupOr.push({ email: new RegExp(`^${escapeRegex(candidateEmail.trim())}$`, 'i') });
      if (candidatePhone) dupOr.push({ phone: candidatePhone.trim() });
      if (candidateName)  dupOr.push({ full_name: new RegExp(`^${escapeRegex(candidateName.trim())}$`, 'i') });
      if (dupOr.length) {
        const existing = await ApplicantRecord.findOne({ $or: dupOr }).lean();
        if (existing) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            existing: {
              _id: existing._id,
              full_name: existing.full_name,
              email: existing.email,
              phone: existing.phone,
              designation: existing.designation,
              status: existing.status,
            },
          });
        }
      }
    }

    const resumeLink = await uploadResumeToDrive(req.file.buffer, req.file.originalname, req.file.mimetype);

    const doc = await Referral.create({
      requisitionId,
      serial_no:   requisition.serial_no,
      designation: requisition.designation,
      hiring_dept: requisition.hiring_dept,
      referrerName, referrerEmail,
      candidateName, candidatePhone, candidateEmail,
      relationship: relationship || '',
      resume: resumeLink,
    });

    triggerReferralSubmitted(doc);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This candidate has already been referred for this role.' });
    }
    console.error('Referral submission error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/referrals — HR dashboard list
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, status, requisitionId, search } = req.query;

    const filter = {};
    if (status)        filter.status        = status;
    if (requisitionId) filter.requisitionId = requisitionId;
    if (search) {
      filter.$or = [
        { candidateName:  { $regex: search, $options: 'i' } },
        { candidateEmail: { $regex: search, $options: 'i' } },
        { referrerName:   { $regex: search, $options: 'i' } },
        { designation:    { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Referral.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Referral.countDocuments(filter),
    ]);

    res.json({ success: true, data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/referrals/mine — the logged-in referrer's own submissions only.
// Must be declared before GET /:id so "mine" isn't swallowed as an id.
router.get('/mine', authenticate, async (req, res) => {
  try {
    const data = await Referral.find({ referrerEmail: req.user.email }).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Referral.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/referrals/:id/status — status-only update from table row.
// 'Converted' is set by HR after they've manually created the full
// CandidateApplication elsewhere — not auto-generated here, since a
// CandidateApplication requires many fields (dob, state, pin code,
// qualification, expected CTC, consent, etc.) this lightweight referral
// form never collects; fabricating placeholder values for those would
// create invalid-looking candidate records instead of real ones.
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const doc = await Referral.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
