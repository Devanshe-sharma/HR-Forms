// routes/applicantRecords.js
// ─────────────────────────────────────────────────────────────────────────────
// Mount in app.js:  app.use('/api/applicant-records', require('./routes/applicantRecords'));
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const ApplicantRecord = require('../models/ApplicantRecord');
const HiringRequisition = require('../models/HiringRequisition');
const RoleMaster = require('../models/role_master');
const { fetchJdText } = require('../utils/googleDocs');

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
  'facebookLink', 'linkedin', 'short_video_url', 'resume',
  'internalNotes',
];

// Shared JD-link resolution, used by both the standalone GET endpoint
// (so HR can see the JD directly in the Candidate Information tab) and
// the /analyze endpoint (so the AI scoring uses the exact same link
// that's actually being shown, not a separately-computed lookup that
// could disagree with it). Queries the raw collection directly,
// bypassing the HiringRequisition Mongoose model entirely — Mongoose
// only returns fields actually declared in its schema, even with
// .lean(), so if the schema doesn't declare whatever exact field
// name/casing a requisition's JD link is actually stored under, it gets
// silently stripped out no matter what's really in the database. Going
// straight to the collection sidesteps that: this returns the document
// exactly as stored, with every field intact.
async function resolveJdLink(jobId) {
  if (!jobId) return { jdLink: null, error: 'No job_id on this record.' };

  const requisition = await HiringRequisition.findOne({ serial_no: jobId }).lean();
  if (!requisition) {
    return { jdLink: null, error: `No requisition found matching job_id ${jobId}` };
  }

  // Primary source: the Designation/Role Master, joined via
  // designation_id (== RoleMaster.desig_id). This has a clean,
  // explicitly-declared jd_link field with no casing ambiguity at all —
  // unlike the requisition document itself, where jd_link has
  // historically been left blank on some records (confirmed directly:
  // requisition #112 genuinely has jd_link: null on the requisition
  // itself, despite the role having a real JD on file in Role Master).
  if (requisition.designation_id != null) {
    const role = await RoleMaster.findOne({ desig_id: requisition.designation_id }).lean();
    if (role?.jd_link) {
      return { jdLink: role.jd_link, error: null };
    }
  }

  // Fallback: the requisition's own jd_link, in case it was filled in
  // directly there instead of (or in addition to) Role Master. Still
  // falls back through the known casing variants, since older/imported
  // requisitions have stored this under inconsistent field names.
  const rawRequisition = await HiringRequisition.collection.findOne({ _id: requisition._id });
  const jdLink =
    rawRequisition?.jd_link ??
    rawRequisition?.JD_Link ??
    rawRequisition?.['JD Link'] ??
    rawRequisition?.jdLink ??
    rawRequisition?.JD_link ??
    null;

  if (!jdLink) {
    return { jdLink: null, error: 'No JD link found on file — checked both the Role Master and the requisition itself.' };
  }

  return { jdLink, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id/jd-link
// Returns the JD link for this candidate's matching requisition, so it
// can be shown directly in the Candidate Information tab.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/jd-link', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);

    const { jdLink, error } = await resolveJdLink(record.job_id);
    if (error) return err(res, error, 400);

    ok(res, { jdLink });
  } catch (e) {
    console.error('[jd-link] error:', e);
    err(res, 'Failed to fetch JD link');
  }
});

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
// POST /api/applicant-records/:id/analyze
// AI fit analysis against the matching requisition's JD. Only ever runs
// when explicitly requested (not automatically on save) — with 200+
// applications, running this unprompted for every one would be a real,
// ongoing API cost with no way to opt out.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/analyze', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    // If the caller already has the JD link on hand (e.g. the
    // Candidate Information tab, which fetches and displays it
    // directly), use that exact value instead of doing a separate
    // internal lookup — guarantees the analysis is always scored
    // against the same JD the person can actually see on screen, with
    // no possibility of the two disagreeing.
    let jdLink = req.body?.jdLink;

    if (!jdLink) {
      if (!record.job_id) {
        return err(
          res,
          'This application has no job_id on record, so the matching requisition can\'t be looked up. This likely predates the job_id fix — re-submitting the application, or checking the original CandidateApplication record, may resolve it.',
          400,
        );
      }

      const resolved = await resolveJdLink(record.job_id);
      if (resolved.error) return err(res, resolved.error, 400);
      jdLink = resolved.jdLink;
    }

    const jdText = await fetchJdText(jdLink);
    if (!jdText) {
      return err(
        res,
        'Could not fetch the JD document content. Check that the JD link is a valid Google Doc, and that it\'s shared with the service account (same one used for resume uploads).',
        400,
      );
    }

    const candidateSummary = `
Name: ${record.full_name}
Applying for: ${record.designation}
Experience: ${record.experience === 'Yes' ? `${record.total_experience || '?'} years` : 'Fresher'}
Highest Qualification: ${record.highest_qualification}
Current CTC: ${record.current_ctc || 'N/A'}
Expected CTC: ${record.expected_monthly_ctc || 'N/A'}
Notice Period: ${record.notice_period || 'N/A'}
Location: ${[record.city, record.state].filter(Boolean).join(', ')}
Willing to relocate: ${record.relocation}
English proficiency: Read ${record.english_read}, Write ${record.english_write}, Speak ${record.english_speak}
Hindi proficiency: Read ${record.hindi_read}, Write ${record.hindi_write}, Speak ${record.hindi_speak}
    `.trim();

    const prompt = `You are helping an HR team evaluate a job candidate's fit for a role.

JOB DESCRIPTION:
${jdText}

CANDIDATE:
${candidateSummary}

Based on the job description above, evaluate how well this candidate fits the role. Respond with ONLY a JSON object (no other text, no markdown code fences) in exactly this format:
{"score": <integer 1-10>, "summary": "<2-3 sentence explanation of the score, mentioning specific strengths or gaps relative to the JD>"}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[analyze] Anthropic API error:', errText);
      return err(res, 'AI analysis request failed', 502);
    }

    const aiData = await aiRes.json();
    const textBlock = aiData.content?.find((b) => b.type === 'text');
    if (!textBlock) return err(res, 'AI response had no text content', 502);

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[analyze] Failed to parse AI response as JSON:', textBlock.text);
      return err(res, 'AI response was not valid JSON', 502);
    }

    const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 0)));
    const summary = parsed.summary || '';

    record.ai_fit_score = score;
    record.ai_fit_summary = summary;
    record.ai_analyzed_at = new Date();
    await record.save();

    ok(res, record.toObject());
  } catch (e) {
    console.error('[analyze] error:', e);
    err(res, 'Failed to analyze application');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id/screener-round
// Stage 1 — HR Screener Round. Mirrors the /final-decision pattern below:
// Shortlisted/Rejected here also sync the top-level status, same reasoning
// as a final decision syncing it — "Candidate On Hold"/"Profile On Hold"
// have no matching value in the status enum, so those only affect this
// stage's own screenerStatus and leave the top-level status untouched.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/screener-round', async (req, res) => {
  try {
    const { screenerName, screenerStatus, screenerNotes } = req.body;

    const update = {};
    if (screenerName   !== undefined) update.screenerName   = screenerName;
    if (screenerStatus !== undefined) update.screenerStatus = screenerStatus;
    if (screenerNotes  !== undefined) update.screenerNotes  = screenerNotes;

    if (screenerStatus === 'Shortlisted')      update.status = 'Shortlisted';
    else if (screenerStatus === 'Rejected')    update.status = 'Rejected';

    const record = await ApplicantRecord.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    ).lean();

    if (!record) return err(res, 'Record not found', 404);
    ok(res, record);
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update screener round');
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
// Stage 3 — Offer & Placement
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