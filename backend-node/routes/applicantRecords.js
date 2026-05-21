// routes/applicantRecords.js
// ─────────────────────────────────────────────────────────────────────────────
// Mount in app.js:  app.use('/api/applicant-records', require('./routes/applicantRecords'));
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const ApplicantRecord = require('../models/ApplicantRecord');

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, msg,  status = 500) => res.status(status).json({ success: false, message: msg });

// Candidate-detail fields that HR is allowed to edit
const CANDIDATE_FIELDS = [
  'full_name', 'email', 'phone', 'whatsapp_same', 'dob',
  'country', 'state', 'city', 'pin_code', 'relocation',
  'designation', 'designation_id', 'highest_qualification',
  'experience', 'total_experience', 'current_ctc', 'notice_period',
  'expected_monthly_ctc',
  'hindi_read', 'hindi_write', 'hindi_speak',
  'english_read', 'english_write', 'english_speak',
  'facebookLink', 'linkedin', 'short_video_url',
  'internalNotes',
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records
// List all (optionally filter by ?status=Shortlisted&search=rahul)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, search, archived } = req.query;
    const query = {};

    if (status)            query.status     = status;
    if (archived !== 'true') query.isArchived = false;   // hide archived by default
    if (search) {
      const re = new RegExp(search, 'i');
      query.$or = [
        { full_name:   re },
        { email:       re },
        { designation: re },
        { city:        re },
        { state:       re },
      ];
    }

    const records = await ApplicantRecord.find(query)
      .sort({ createdAt: -1 })
      .lean();

    ok(res, records);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to fetch applicant records');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);
    ok(res, record);
  } catch (e) {
    err(res, 'Failed to fetch record');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id
// Update candidate details + status + internalNotes in one call
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const allowed = {};
    for (const field of [...CANDIDATE_FIELDS, 'status']) {
      if (req.body[field] !== undefined) allowed[field] = req.body[field];
    }

    const record = await ApplicantRecord.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { new: true, runValidators: true },
    ).lean();

    if (!record) return err(res, 'Record not found', 404);
    ok(res, record);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update record');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id/status  (quick status-only update)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return err(res, 'status is required', 400);

    const record = await ApplicantRecord.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true },
    ).lean();

    if (!record) return err(res, 'Record not found', 404);
    ok(res, record);
  } catch (e) {
    err(res, 'Failed to update status');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds
// Add a new interview round
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    const nextRoundNumber = (record.interviewRounds.length ?? 0) + 1;

    const newRound = {
      roundNumber:   nextRoundNumber,
      stage:         req.body.stage         || 'HR Screening',
      customStage:   req.body.customStage   || '',
      scheduledDate: req.body.scheduledDate || null,
      interviewer:   req.body.interviewer   || '',
      mode:          req.body.mode          || 'Not decided',
      feedback:      req.body.feedback      || '',
      result:        req.body.result        || 'Pending',
    };

    record.interviewRounds.push(newRound);
    await record.save();

    ok(res, record.toObject(), 201);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to add interview round');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id/interview-rounds/:roundId
// Update a specific round
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/interview-rounds/:roundId', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    const round = record.interviewRounds.id(req.params.roundId);
    if (!round) return err(res, 'Round not found', 404);

    const updatable = ['stage', 'customStage', 'scheduledDate', 'interviewer', 'mode', 'feedback', 'result'];
    for (const field of updatable) {
      if (req.body[field] !== undefined) round[field] = req.body[field];
    }

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update round');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/applicant-records/:id/interview-rounds/:roundId
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/interview-rounds/:roundId', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    record.interviewRounds = record.interviewRounds.filter(
      (r) => r._id.toString() !== req.params.roundId,
    );

    // Re-number rounds after deletion
    record.interviewRounds.forEach((r, i) => { r.roundNumber = i + 1; });

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    err(res, 'Failed to delete round');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id/final-decision
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/final-decision', async (req, res) => {
  try {
    const { decision, offeredCTC, joiningDate, decisionDate, notes } = req.body;

    const update = {};
    if (decision     !== undefined) update['finalDecision.decision']     = decision;
    if (offeredCTC   !== undefined) update['finalDecision.offeredCTC']   = offeredCTC;
    if (joiningDate  !== undefined) update['finalDecision.joiningDate']  = joiningDate || null;
    if (decisionDate !== undefined) update['finalDecision.decisionDate'] = decisionDate || null;
    if (notes        !== undefined) update['finalDecision.notes']        = notes;

    // If a real decision is being set, sync the top-level status too
    if (decision === 'Offer Made')           update.status = 'Hired';
    else if (decision === 'Rejected')        update.status = 'Rejected';

    const record = await ApplicantRecord.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

    if (!record) return err(res, 'Record not found', 404);
    ok(res, record);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update final decision');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/applicant-records/:id  (soft-archive)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await ApplicantRecord.findByIdAndUpdate(req.params.id, { isArchived: true });
    ok(res, { archived: true });
  } catch (e) {
    err(res, 'Failed to archive record');
  }
});

module.exports = router;