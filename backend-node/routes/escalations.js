const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const Escalation = require('../models/Escalation');
const { authenticate } = require('../middleware/authenticate');
const { uploadFileToDrive } = require('../utils/googleDrive');

const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/escalations — log a new BO-internal escalation/interaction.
// The attachment is best-effort: if Drive isn't configured for this
// folder, the record is still saved (without a link) rather than
// blocking the whole submission on Drive setup.
router.post('/', authenticate, uploadAttachment.single('attachment'), async (req, res) => {
  try {
    const body = req.body;
    const createdBy = JSON.parse(body.createdBy || '{}');
    const targetEmployees = JSON.parse(body.targetEmployees || '[]');

    if (!createdBy.employeeId || !createdBy.name) {
      return res.status(400).json({ success: false, message: 'Creator information is missing.' });
    }
    if (!body.escalationFor || !body.rating || !body.category || !body.mode || !body.message) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    let attachmentUrl = '';
    let attachmentName = '';
    if (req.file) {
      attachmentName = req.file.originalname;
      try {
        attachmentUrl = await uploadFileToDrive(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          process.env.GOOGLE_DRIVE_ESCALATION_FOLDER_ID
        );
      } catch (uploadErr) {
        console.error('Escalation attachment upload failed — saving record without it:', uploadErr.message);
      }
    }

    const doc = await Escalation.create({
      createdBy,
      escalationFor: body.escalationFor,
      targetEmployees,
      rating: body.rating,
      category: body.category,
      mode: body.mode,
      subject: body.subject || '',
      message: body.message,
      attachmentUrl,
      attachmentName,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('Escalation submission error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/escalations — dashboard list, newest first.
router.get('/', async (req, res) => {
  try {
    const { category, mode, escalationFor, search } = req.query;

    const filter = {};
    if (category)      filter.category      = category;
    if (mode)          filter.mode          = mode;
    if (escalationFor) filter.escalationFor = escalationFor;
    if (search) {
      filter.$or = [
        { 'createdBy.name':    { $regex: search, $options: 'i' } },
        { 'targetEmployees.name': { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await Escalation.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Escalation.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
