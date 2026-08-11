// routes/referrals.js
const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const Referral           = require('../models/Referral');
const HiringRequisition  = require('../models/HiringRequisition');
const { uploadResumeToDrive } = require('../utils/googleDrive');
const { triggerReferralSubmitted } = require('../emails');

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

// POST /api/referrals — public, unauthenticated (reached via the
// referral-invite email link, not a logged-in HR action).
router.post('/', uploadResume.single('resume'), async (req, res) => {
  try {
    const { requisitionId, referrerName, referrerEmail, candidateName, candidatePhone, candidateEmail, relationship } = req.body;

    if (!requisitionId || !referrerName || !referrerEmail || !candidateName || !candidatePhone || !candidateEmail) {
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
