// routes/applicantRecords.js
// ─────────────────────────────────────────────────────────────────────────────
// Mount in app.js:  app.use('/api/applicant-records', require('./routes/applicantRecords'));
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const ApplicantRecord = require('../models/ApplicantRecord');
const HiringRequisition = require('../models/HiringRequisition');
const RoleMaster = require('../models/role_master');
const Onboarding = require('../models/onboardingModel');
const { fetchJdText } = require('../utils/googleDocs');
const sendInterviewRoundMail = require('../emails/senders/sendInterviewRoundMail');
const buildInterviewRoundMail = require('../emails/templates/interviewRoundMail');
const sendCandidateRejection = require('../emails/senders/sendCandidateRejection');
const buildCandidateRejection = require('../emails/templates/candidateRejection');
const { signInterviewConfirm, verifyInterviewConfirm } = require('../utils/interviewConfirmSigning');
const { signCandidateUpload, verifyCandidateUpload } = require('../utils/candidateUploadSigning');
const { uploadFileToDrive, createDriveFolder } = require('../utils/googleDrive');
const sendOfferLetter = require('../emails/senders/sendOfferLetter');
const REQUIRED_CANDIDATE_DOCUMENTS = require('../utils/requiredCandidateDocuments');
const { addEvent } = require('../utils/candidateEvents');
const { ROUND_TYPE_ORDER, ROUND_TYPE_LABELS, roundLabel, hasPassedRound, previousRoundType, canAddRound } = require('../utils/roundPipeline');
const { computeAtsMatchScore } = require('../utils/atsMatchScore');
const { EXCEL_QUESTIONS, DISC_QUESTIONS, scoreDisc } = require('../utils/assessmentBank');
const { sendMail } = require('../emails/mailer');

// Backend is reverse-proxied under the same domain as the frontend at
// /api (see frontend/.env.production) — same FRONTEND_URL convention
// already used for other emailed links (onboardingroutes.js's share-link).
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';
const PUBLIC_API_BASE = `${FRONTEND_URL}/api`;

// The interviewer's feedback form is a real React page (candidate details
// + JD for context, status dropdown, feedback textarea) rather than a
// plain server-rendered page — so this links straight to the frontend,
// not PUBLIC_API_BASE.
function buildFeedbackLink(recordId, roundId) {
  const sig = signInterviewConfirm(String(recordId), String(roundId), 'feedback');
  return `${FRONTEND_URL}/interview-feedback/${recordId}/${roundId}?sig=${sig}`;
}

// Small self-contained HTML page for the public (unauthenticated) interview
// response links — this backend has no templating engine wired in, so this
// is a plain string response matching the style of the confirmation emails.
function renderResponsePage({ heading, message, color = '#1a3e72', showForm = false, formAction = '' }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Interview Response — Brisk Olive HR</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6fa;margin:0;padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e4eaf4;overflow:hidden;">
    <div style="background:${color};padding:20px 28px;">
      <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Brisk Olive HR</p>
      <h2 style="margin:6px 0 0;color:#ffffff;font-size:18px;">${heading}</h2>
    </div>
    <div style="padding:28px;">
      <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 ${showForm ? '16px' : '0'};">${message}</p>
      ${showForm ? `
        <form method="POST" action="${formAction}">
          <textarea name="reason" rows="3" placeholder="Please share the reason (optional)"
            style="width:100%;box-sizing:border-box;border:1px solid #d0dff5;border-radius:8px;padding:10px;font-size:14px;font-family:inherit;"></textarea>
          <button type="submit"
            style="margin-top:12px;background:#dc3545;color:#ffffff;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
            Submit
          </button>
        </form>
      ` : ''}
    </div>
  </div>
</body></html>`;
}

// Interviewer is only stored as a plain name string on the round — this
// looks up their email from the employee master by exact (case-insensitive)
// name match at send time, same source the Interviewer Name dropdown itself
// is populated from.
async function resolveInterviewerEmail(name) {
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const employee = await Onboarding.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).lean();
  return employee?.officialEmail || employee?.persEmail || null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, msg,  status = 500) => res.status(status).json({ success: false, message: msg });

// A candidate only counts as actually "In Progress" once an interview round
// has been carried out — merely scheduling one isn't enough. Never moves a
// record OFF 'In Progress' (or back from Shortlisted/Rejected); it only ever
// advances the initial 'New' default forward, once.
function maybeAdvanceInterviewStatus(record) {
  if (record.interviewFinalStatus !== 'New') return;
  const hasDoneRound = (record.interviewRounds || []).some((r) => r.schedulingStatus === 'Done');
  if (hasDoneRound) record.interviewFinalStatus = 'In Progress';
}

// Recomputes and sets atsMatchScore on a (Mongoose document) record — call
// after any edit to a field the score depends on (skills, experience,
// location, notice period) or right after creation. Best-effort: a missing/
// unmatched requisition just means the "no requirement on file" neutral
// defaults in utils/atsMatchScore.js apply, never a hard failure.
async function recomputeAtsScore(record) {
  try {
    const requisition = record.job_id
      ? await HiringRequisition.findOne({ serial_no: record.job_id }).lean()
      : null;
    record.atsMatchScore = computeAtsMatchScore(record, requisition);
  } catch (e) {
    console.error('[recomputeAtsScore] error:', e.message);
  }
}

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
// Fields that feed atsMatchScore — an edit to any of these means the score
// is now stale and needs recomputing (see recomputeAtsScore above).
const ATS_SCORE_INPUT_FIELDS = ['total_experience', 'notice_period', 'relocation', 'city', 'state', 'experience', 'designation', 'designation_id'];

router.patch('/:id', async (req, res) => {
  try {
    const allowed = {};
    for (const field of [...CANDIDATE_FIELDS, 'status']) {
      if (req.body[field] !== undefined) allowed[field] = req.body[field];
    }

    const needsRescore = ATS_SCORE_INPUT_FIELDS.some((f) => req.body[f] !== undefined);
    let record;
    if (needsRescore) {
      record = await ApplicantRecord.findById(req.params.id);
      if (!record) return err(res, 'Record not found', 404);
      Object.assign(record, allowed);
      await recomputeAtsScore(record);
      await record.save();
      record = record.toObject();
    } else {
      record = await ApplicantRecord.findByIdAndUpdate(
        req.params.id,
        { $set: allowed },
        { new: true, runValidators: true },
      ).lean();
      if (!record) return err(res, 'Record not found', 404);
    }

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
// PATCH /api/applicant-records/:id/interview-final-status
// Overall outcome of the interview stage. Constrained server-side (not
// just disabled in the UI) by what interviewers have recommended on
// individual rounds: a Recommended-P1/P2 candidate can't be marked
// Rejected, and a Not-Recommended one can't be marked Shortlisted —
// conflicting signals across rounds block both, leaving only In Progress.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/interview-final-status', async (req, res) => {
  try {
    const { interviewFinalStatus } = req.body;
    if (!['In Progress', 'Shortlisted', 'Rejected'].includes(interviewFinalStatus)) {
      return err(res, 'Invalid interviewFinalStatus', 400);
    }

    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    // Conflicting signals across rounds (one Recommended, another Not
    // Recommended) must not block BOTH options — that would leave the
    // candidate stuck at "In Progress" with no way to resolve it. A real
    // conflict is left to HR's judgment instead of being blocked outright.
    const feedbackStatuses = (record.interviewRounds || []).map((r) => r.interviewerFeedbackStatus).filter(Boolean);
    const hasRecommended    = feedbackStatuses.some((s) => s === 'Recommended as P1' || s === 'Recommended as P2');
    const hasNotRecommended = feedbackStatuses.includes('Not Recommended');
    const conflictingSignals = hasRecommended && hasNotRecommended;

    if (interviewFinalStatus === 'Rejected' && hasRecommended && !conflictingSignals) {
      return err(res, 'This candidate has a Recommended (P1/P2) interview round on file — cannot be marked Rejected.', 400);
    }
    if (interviewFinalStatus === 'Shortlisted' && hasNotRecommended && !conflictingSignals) {
      return err(res, 'This candidate has a Not Recommended interview round on file — cannot be marked Shortlisted.', 400);
    }

    record.interviewFinalStatus = interviewFinalStatus;
    // Keep the top-level status in sync, same convention as
    // screener-round/final-decision — the interview stage is later, so
    // it takes precedence here.
    if (interviewFinalStatus === 'Shortlisted')    record.status = 'Shortlisted';
    else if (interviewFinalStatus === 'Rejected')  record.status = 'Rejected';

    addEvent(record, 'interview-final-status', `Interview Stage: ${interviewFinalStatus}`);

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error('[interview-final-status] error:', e);
    err(res, 'Failed to update interview final status');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/rejection-mail/preview
// Builds the default subject/body for the candidate rejection mail,
// without sending — seeds the same "Edit & Send Mail" style popup used
// for interview round mails.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/rejection-mail/preview', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);

    const { subject, body } = buildCandidateRejection({
      candidateName: record.full_name,
      position: record.designation,
    });

    ok(res, { to: record.email || '', subject, body });
  } catch (e) {
    console.error('[rejection-mail preview] error:', e);
    err(res, 'Failed to build rejection mail preview');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/rejection-mail/send
// Sends the rejection mail — To/CC/Subject/Body are all HR-editable
// overrides from the popup, same convention as interview round mails.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/rejection-mail/send', async (req, res) => {
  try {
    const { to: toOverride, cc, subject: subjectOverride, customBody } = req.body;

    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (record.rejectionMailSentAt) {
      return err(res, 'Rejection mail has already been sent for this candidate.', 400);
    }

    const to = toOverride || record.email;
    if (!to) return err(res, 'No candidate email on file', 400);

    await sendCandidateRejection({
      to, cc,
      candidateName: record.full_name,
      position: record.designation,
      subjectOverride, customBody,
    });

    record.rejectionMailSentAt = new Date();
    addEvent(record, 'rejection-mail-sent', 'Rejection Mail Sent');
    await record.save();

    ok(res, { sentTo: to, record: record.toObject() });
  } catch (e) {
    console.error('[rejection-mail send] error:', e);
    err(res, 'Failed to send rejection mail');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds
// Add a new interview round, in the fixed HR -> Technical -> Management
// pipeline (see utils/roundPipeline.js). `roundType` is required; a round
// can only be added once the round before it in the pipeline has passed.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds', async (req, res) => {
  try {
    const { roundType } = req.body;
    if (!['hr', 'tech', 'mgmt'].includes(roundType)) {
      return err(res, 'roundType must be one of: hr, tech, mgmt', 400);
    }

    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    if (!canAddRound(record, roundType)) {
      const prev = previousRoundType(roundType);
      return err(res, `The ${ROUND_TYPE_LABELS[prev]} must be passed (Done, with a positive recommendation) before adding a ${ROUND_TYPE_LABELS[roundType]}.`, 400);
    }

    const nextRoundNumber = record.interviewRounds.filter((r) => r.roundType === roundType).length + 1;

    const newRound = {
      roundType,
      roundNumber:   nextRoundNumber,
      stage:         roundLabel(roundType, nextRoundNumber),
      schedulingStatus:      req.body.schedulingStatus      || '',
      cancellationReason:    req.body.cancellationReason    || '',
      scheduledDate:         req.body.scheduledDate         || null,
      scheduledTime:         req.body.scheduledTime         || '',
      interviewer:           req.body.interviewer           || '',
      mode:                  req.body.mode                  || '',
      meetingLink:           req.body.meetingLink           || '',
      candidateConfirmation: req.body.candidateConfirmation || 'Pending',
      note:                  req.body.note                  || '',
      feedback:              req.body.feedback              || '',
      interviewerFeedbackStatus: req.body.interviewerFeedbackStatus || '',
      bond:                  req.body.bond                  || '',
    };

    record.interviewRounds.push(newRound);
    maybeAdvanceInterviewStatus(record);
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

    // A round marked Done is final — no further edits, enforced here (not
    // just hidden in the UI) since a stale client could otherwise still
    // PATCH around it. The transition INTO Done itself (via Mark Done)
    // still works fine, since at that point the round isn't Done yet.
    if (round.schedulingStatus === 'Done') {
      return err(res, 'This round is marked Done and cannot be edited.', 400);
    }

    const updatable = [
      'schedulingStatus', 'cancellationReason', 'scheduledDate', 'scheduledTime',
      'interviewer', 'mode', 'meetingLink', 'candidateConfirmation',
      'note', 'feedback', 'interviewerFeedbackStatus', 'bond',
    ];
    for (const field of updatable) {
      if (req.body[field] !== undefined) round[field] = req.body[field];
    }
    // hrBackground is the one nested-object field — merged key by key so a
    // partial save (editing just one of the 17 fields) doesn't blank the rest.
    if (req.body.hrBackground && typeof req.body.hrBackground === 'object') {
      Object.assign(round.hrBackground, req.body.hrBackground);
    }

    if (req.body.schedulingStatus) {
      const label = round.stage || `Round ${round.roundNumber}`;
      addEvent(record, `round-${round._id}-${req.body.schedulingStatus}`, `${label}: ${req.body.schedulingStatus}`, round.interviewer ? `With ${round.interviewer}` : '');
    }
    if (req.body.feedback !== undefined || req.body.interviewerFeedbackStatus !== undefined) {
      const label = round.stage || `Round ${round.roundNumber}`;
      addEvent(record, `round-${round._id}-feedback`, `${label}: Feedback Submitted`, round.interviewerFeedbackStatus || '');
    }

    maybeAdvanceInterviewStatus(record);
    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update round');
  }
});

// Only the candidate's schedule/reschedule mail gets the Yes/Maybe/Can't
// attend buttons — not the interviewer's copy, and not cancellation mails.
function buildConfirmLinks(recordId, roundId, audience, type) {
  if (audience !== 'candidate' || type === 'cancel') return undefined;
  const sig = signInterviewConfirm(String(recordId), String(roundId));
  const base = `${PUBLIC_API_BASE}/applicant-records/${recordId}/interview-rounds/${roundId}/respond`;
  return {
    yes:   `${base}?response=yes&sig=${sig}`,
    maybe: `${base}?response=maybe&sig=${sig}`,
    no:    `${base}?response=no&sig=${sig}`,
  };
}

// Only the interviewer's schedule/reschedule mail gets a feedback-form
// link — not the candidate's copy, and not cancellation mails (nothing to
// give feedback on if the round never happened).
function buildFeedbackLinkFor(audience, type, recordId, roundId) {
  if (audience !== 'interviewer' || type === 'cancel') return undefined;
  return buildFeedbackLink(recordId, roundId);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds/:roundId/preview-mail
// Builds the exact subject/body the send-mail route would generate by
// default, without sending anything — seeds the "Edit & Send Mail" popup
// so HR edits the real default text instead of starting from a blank box.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds/:roundId/preview-mail', async (req, res) => {
  try {
    const { type, audience, cancellationReason } = req.body;
    if (!['schedule', 'reschedule', 'cancel'].includes(type)) return err(res, 'Invalid mail type', 400);
    if (!['interviewer', 'candidate'].includes(audience)) return err(res, 'Invalid audience', 400);

    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);
    const round = (record.interviewRounds || []).find((r) => String(r._id) === req.params.roundId);
    if (!round) return err(res, 'Round not found', 404);

    const to = audience === 'candidate' ? record.email : await resolveInterviewerEmail(round.interviewer);
    const feedbackLink = buildFeedbackLinkFor(audience, type, record._id, round._id);

    const { subject, body } = buildInterviewRoundMail({
      type,
      audience,
      candidateName: record.full_name,
      position: record.designation,
      round,
      cancellationReason: cancellationReason ?? round.cancellationReason,
      confirmLinks: buildConfirmLinks(record._id, round._id, audience, type),
      feedbackLink,
    });

    // willIncludeFeedbackLink is purely informational — the dashboard shows
    // a note that the "Submit Interview Feedback" button will be added,
    // separate from the editable subject/body. Previous-round/screener
    // feedback is intentionally NOT included here — it belongs only on the
    // interviewer's own feedback-context page (GET .../feedback-context),
    // not in this mail.
    ok(res, { to: to || '', subject, body, willIncludeFeedbackLink: !!feedbackLink });
  } catch (e) {
    console.error('[preview-mail] error:', e);
    err(res, 'Failed to build mail preview');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds/:roundId/send-mail
// Schedule / reschedule / cancellation notifications — to the interviewer
// or the candidate, one audience per call so the UI can track each send
// independently. To/CC/Subject/Body are all HR-editable via the "Edit &
// Send Mail" popup for either audience — cancellationReason in the body
// overrides the round's saved one, since this can be sent before the
// cancellation is finalized.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds/:roundId/send-mail', async (req, res) => {
  try {
    const { type, audience, cancellationReason, to: toOverride, cc, subject: subjectOverride, customBody } = req.body;
    if (!['schedule', 'reschedule', 'cancel'].includes(type)) return err(res, 'Invalid mail type', 400);
    if (!['interviewer', 'candidate'].includes(audience)) return err(res, 'Invalid audience', 400);

    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);
    const round = (record.interviewRounds || []).find((r) => String(r._id) === req.params.roundId);
    if (!round) return err(res, 'Round not found', 404);

    // HR can override the resolved To before sending (e.g. the
    // employee-master lookup missed the interviewer, or the candidate's
    // mail needs redirecting) — falls back to the real lookup/candidate
    // email on file when left blank.
    const to = toOverride || (audience === 'candidate' ? record.email : await resolveInterviewerEmail(round.interviewer));
    if (!to) return err(res, `No ${audience === 'candidate' ? 'candidate email' : 'interviewer email'} on file`, 400);

    await sendInterviewRoundMail({
      to,
      cc,
      type,
      audience,
      candidateName: record.full_name,
      position: record.designation,
      round,
      cancellationReason: cancellationReason ?? round.cancellationReason,
      confirmLinks: buildConfirmLinks(record._id, round._id, audience, type),
      feedbackLink: buildFeedbackLinkFor(audience, type, record._id, round._id),
      subjectOverride,
      customBody,
    });

    ok(res, { sentTo: to });
  } catch (e) {
    console.error('[send-mail] error:', e);
    err(res, 'Failed to send mail');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id/interview-rounds/:roundId/respond
// Public, unauthenticated — this is what the candidate hits by clicking a
// Yes / Maybe / Can't-attend button in the schedule/reschedule email.
// Yes and Maybe record immediately; Can't-attend shows a short reason form
// first (posted below) rather than recording on the GET itself.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/interview-rounds/:roundId/respond', async (req, res) => {
  const { id, roundId } = req.params;
  const { response, sig } = req.query;

  if (!['yes', 'maybe', 'no'].includes(response)) {
    return res.status(400).send(renderResponsePage({
      heading: 'Invalid Link', color: '#dc3545',
      message: 'This confirmation link is invalid.',
    }));
  }
  if (!verifyInterviewConfirm(id, roundId, sig)) {
    return res.status(403).send(renderResponsePage({
      heading: 'Link Could Not Be Verified', color: '#dc3545',
      message: "This confirmation link couldn't be verified. Please contact HR directly if you need to respond.",
    }));
  }

  try {
    const record = await ApplicantRecord.findById(id);
    if (!record) return res.status(404).send(renderResponsePage({ heading: 'Not Found', color: '#dc3545', message: 'This interview record could not be found.' }));
    const round = record.interviewRounds.id(roundId);
    if (!round) return res.status(404).send(renderResponsePage({ heading: 'Not Found', color: '#dc3545', message: 'This interview round could not be found.' }));

    // Once recorded, the response is locked — clicking any link again (even
    // a different one from the same email) shows the existing response
    // instead of silently overwriting it.
    if (round.candidateConfirmation && round.candidateConfirmation !== 'Pending') {
      return res.send(renderResponsePage({
        heading: 'Already Responded', color: '#6b7a99',
        message: `You've already responded to this interview invitation: <b>${round.candidateConfirmation}</b>. If you need to change your response, please contact HR directly.`,
      }));
    }

    if (response === 'no') {
      return res.send(renderResponsePage({
        heading: "Can't Attend", color: '#dc3545',
        message: "We're sorry to hear that. Could you let us know why, so our team can follow up appropriately?",
        showForm: true,
        formAction: `${req.baseUrl}/${id}/interview-rounds/${roundId}/respond?response=no&sig=${sig}`,
      }));
    }

    round.candidateConfirmation = response === 'yes' ? 'Yes' : 'Maybe';
    await record.save();

    return res.send(renderResponsePage(
      response === 'yes'
        ? { heading: 'Thank You!', color: '#28a745', message: "Thanks for confirming — we'll see you at the interview!" }
        : { heading: 'Response Recorded', color: '#fb8c00', message: 'Thanks for letting us know. Our team will follow up if needed.' },
    ));
  } catch (e) {
    console.error('[interview-respond GET] error:', e);
    return res.status(500).send(renderResponsePage({ heading: 'Something Went Wrong', color: '#dc3545', message: 'Please try again later or contact HR directly.' }));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds/:roundId/respond
// Handles the "Can't attend" reason form submitted from the GET route above.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds/:roundId/respond', async (req, res) => {
  const { id, roundId } = req.params;
  const { response, sig } = req.query;
  const { reason } = req.body;

  if (response !== 'no' || !verifyInterviewConfirm(id, roundId, sig)) {
    return res.status(403).send(renderResponsePage({
      heading: 'Invalid Request', color: '#dc3545',
      message: "This request couldn't be verified. Please contact HR directly if you need to respond.",
    }));
  }

  try {
    const record = await ApplicantRecord.findById(id);
    if (!record) return res.status(404).send(renderResponsePage({ heading: 'Not Found', color: '#dc3545', message: 'This interview record could not be found.' }));
    const round = record.interviewRounds.id(roundId);
    if (!round) return res.status(404).send(renderResponsePage({ heading: 'Not Found', color: '#dc3545', message: 'This interview round could not be found.' }));

    if (round.candidateConfirmation && round.candidateConfirmation !== 'Pending') {
      return res.send(renderResponsePage({
        heading: 'Already Responded', color: '#6b7a99',
        message: `You've already responded to this interview invitation: <b>${round.candidateConfirmation}</b>. If you need to change your response, please contact HR directly.`,
      }));
    }

    round.candidateConfirmation = 'No';
    if ((reason || '').trim()) round.note = reason.trim();
    await record.save();

    return res.send(renderResponsePage({
      heading: 'Response Recorded', color: '#dc3545',
      message: "Thanks for letting us know — we've recorded that you can't attend. Our HR team will be in touch to reschedule.",
    }));
  } catch (e) {
    console.error('[interview-respond POST] error:', e);
    return res.status(500).send(renderResponsePage({ heading: 'Something Went Wrong', color: '#dc3545', message: 'Please try again later or contact HR directly.' }));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id/interview-rounds/:roundId/feedback-context?sig=...
// Public, unauthenticated — feeds the interviewer's feedback form page with
// exactly what it needs: candidate details + JD for context, plus whatever
// feedback is already on file (so re-visiting the link to update it works).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/interview-rounds/:roundId/feedback-context', async (req, res) => {
  try {
    const { sig } = req.query;
    if (!verifyInterviewConfirm(req.params.id, req.params.roundId, sig, 'feedback')) {
      return err(res, "This link couldn't be verified.", 403);
    }

    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);
    const allRounds = record.interviewRounds || [];
    const round = allRounds.find((r) => String(r._id) === req.params.roundId);
    if (!round) return err(res, 'Round not found', 404);

    const { jdLink } = await resolveJdLink(record.job_id);

    // Prior-round context — every earlier round's feedback (HR included, now
    // that it's a round in the pipeline rather than a separate screener
    // step) — so the next interviewer isn't starting from zero. "Earlier"
    // means earlier in the HR -> Technical -> Management pipeline order,
    // then by roundNumber within that type (roundNumber only counts
    // instances of the SAME type, so it can't be compared directly across
    // different round types).
    const pipelineRank = (r) => ROUND_TYPE_ORDER.indexOf(r.roundType) * 1000 + (r.roundNumber ?? 0);
    const previousRounds = allRounds
      .filter((r) => pipelineRank(r) < pipelineRank(round) && (r.feedback || r.interviewerFeedbackStatus))
      .sort((a, b) => pipelineRank(a) - pipelineRank(b))
      .map((r) => ({
        stage: r.stage || `Round ${r.roundNumber}`,
        interviewer: r.interviewer || '',
        interviewerFeedbackStatus: r.interviewerFeedbackStatus || '',
        feedback: r.feedback || '',
      }));

    ok(res, {
      candidate: {
        name:        record.full_name,
        designation: record.designation,
        resume:      record.resume || '',
        linkedin:    record.linkedin || '',
      },
      jdLink: jdLink || '',
      round: { stage: round.stage, roundType: round.roundType, scheduledDate: round.scheduledDate, scheduledTime: round.scheduledTime, interviewer: round.interviewer || '' },
      interviewerFeedbackStatus: round.interviewerFeedbackStatus || '',
      feedback: round.feedback || '',
      previousRounds,
    });
  } catch (e) {
    console.error('[feedback-context] error:', e);
    err(res, 'Failed to load the feedback form');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/interview-rounds/:roundId/feedback?sig=...
// Public, unauthenticated — the interviewer's feedback form submits here.
// Freely re-submittable (unlike the candidate's confirmation), since an
// interviewer may reasonably want to add or amend feedback after the fact.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/interview-rounds/:roundId/feedback', async (req, res) => {
  try {
    const { sig } = req.query;
    if (!verifyInterviewConfirm(req.params.id, req.params.roundId, sig, 'feedback')) {
      return err(res, "This link couldn't be verified.", 403);
    }

    const { interviewerFeedbackStatus, feedback } = req.body;
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    const round = record.interviewRounds.id(req.params.roundId);
    if (!round) return err(res, 'Round not found', 404);

    if (interviewerFeedbackStatus !== undefined) round.interviewerFeedbackStatus = interviewerFeedbackStatus;
    if (feedback !== undefined) round.feedback = feedback;

    const label = round.stage || `Round ${round.roundNumber}`;
    addEvent(record, `round-${round._id}-feedback`, `${label}: Feedback Submitted`, interviewerFeedbackStatus || '');

    await record.save();

    ok(res, { saved: true });
  } catch (e) {
    console.error('[interview feedback submit] error:', e);
    err(res, 'Failed to submit feedback');
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

    // Re-number each roundType's own instances after deletion — roundNumber
    // counts occurrences within a type (HR Round, HR Round 2, ...), not
    // position in the overall array.
    ['hr', 'tech', 'mgmt'].forEach((type) => {
      record.interviewRounds.filter((r) => r.roundType === type).forEach((r, i) => {
        r.roundNumber = i + 1;
        r.stage = roundLabel(type, i + 1);
      });
    });

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
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (!hasPassedRound(record, 'mgmt')) {
      return err(res, 'The Management Round must be passed (Select / Select with Conditions) before Offer & Placement can be used.', 400);
    }

    const { decision, offeredCTC, joiningDate, decisionDate, notes } = req.body;

    if (decision     !== undefined) record.finalDecision.decision     = decision;
    if (offeredCTC   !== undefined) record.finalDecision.offeredCTC   = offeredCTC;
    if (joiningDate  !== undefined) record.finalDecision.joiningDate  = joiningDate || null;
    if (decisionDate !== undefined) record.finalDecision.decisionDate = decisionDate || null;
    if (notes        !== undefined) record.finalDecision.notes        = notes;

    // If a real decision is being set, sync the top-level status too
    if (decision === 'Offer Made')           record.status = 'Hired';
    else if (decision === 'Rejected')        record.status = 'Rejected';

    if (decision) {
      addEvent(record, 'final-decision', `Offer Decision: ${decision}`, offeredCTC ? `Offered CTC: ${offeredCTC}` : '');
      // Offer Made kicks off joining tracking, if it hasn't started already.
      if (decision === 'Offer Made' && !record.joining.status) {
        record.joining.status = 'Joining Pending';
      }
    }

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error(e);
    err(res, 'Failed to update final decision');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/send-offer-letter
// HR-triggered from OfferPlacementTab, once finalDecision.decision is
// "Offer Made". Just emails the Offer Letter with a signed link to the
// public document-upload page — no Drive folder is created here. The
// candidate's folder is only created once, lazily, the first time they
// actually submit documents (see POST /:id/upload-documents below), not
// merely because the email went out.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/send-offer-letter', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (record.finalDecision?.decision !== 'Offer Made') {
      return err(res, 'The Offer & Placement decision must be "Offer Made" before sending the Offer Letter.', 400);
    }
    if (!record.email) return err(res, 'This candidate has no email on file.', 400);

    const sig = signCandidateUpload(String(record._id));
    const uploadLink = `${FRONTEND_URL}/candidate-upload/${record._id}?sig=${sig}`;

    await sendOfferLetter({
      to: record.email,
      full_name: record.full_name,
      joiningDate: record.finalDecision?.joiningDate,
      uploadLink,
    });

    record.offerLetterSentAt = new Date();
    addEvent(record, 'offer-letter-sent', 'Offer Letter Sent');
    await record.save();

    ok(res, record.toObject());
  } catch (e) {
    console.error('[send-offer-letter] error:', e);
    err(res, 'Failed to send offer letter');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id/document-upload-context?sig=...
// Public, unauthenticated — feeds the candidate's document-upload page.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/document-upload-context', async (req, res) => {
  try {
    const { id } = req.params;
    const { sig } = req.query;
    if (!verifyCandidateUpload(id, sig)) return err(res, 'This link could not be verified.', 403);

    const record = await ApplicantRecord.findById(id).lean();
    if (!record) return err(res, 'Record not found', 404);

    ok(res, {
      full_name: record.full_name,
      designation: record.designation,
      joiningDate: record.finalDecision?.joiningDate || null,
      requiredDocuments: REQUIRED_CANDIDATE_DOCUMENTS,
      uploadedDocuments: record.uploadedDocuments || [],
    });
  } catch (e) {
    console.error('[document-upload-context] error:', e);
    err(res, 'Something went wrong loading this page.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/upload-documents?sig=...
// Public, unauthenticated — the candidate's document-upload page submits
// ALL staged documents (across every required-document type) in one single
// request from one Submit button. The candidate's own Drive folder is
// created here, lazily, the first time they actually submit something —
// not when the Offer Letter email goes out, and not for an empty
// submission. Later visits reuse the same folder and just append to
// uploadedDocuments, so nothing already uploaded is ever replaced.
// ─────────────────────────────────────────────────────────────────────────────
const uploadCandidateDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
}).fields(REQUIRED_CANDIDATE_DOCUMENTS.map((d) => ({ name: d.key, maxCount: 10 })));

router.post('/:id/upload-documents', uploadCandidateDocs, async (req, res) => {
  try {
    const { id } = req.params;
    const { sig } = req.query;
    if (!verifyCandidateUpload(id, sig)) return err(res, 'This link could not be verified.', 403);

    const record = await ApplicantRecord.findById(id);
    if (!record) return err(res, 'Record not found', 404);

    const validKeys = new Set(REQUIRED_CANDIDATE_DOCUMENTS.map((d) => d.key));
    const files = req.files || {};
    const filesToUpload = Object.entries(files).filter(([docType]) => validKeys.has(docType));
    const hasFiles = filesToUpload.some(([, fileList]) => fileList.length > 0);

    if (!hasFiles) {
      return err(res, 'No files were selected.', 400);
    }

    // Created here, on the candidate's first real submission — not when
    // the Offer Letter was sent, and not for a would-be-empty submission.
    if (!record.documentsUploadFolderId) {
      const parentFolderId = process.env.GOOGLE_DRIVE_CANDIDATE_DOCS_PARENT_FOLDER_ID || process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;
      const folder = await createDriveFolder(`${record.full_name} - ${record._id}`, parentFolderId);
      record.documentsUploadFolderId = folder.id;
      record.documentsUploadFolderLink = folder.webViewLink;
    }

    for (const [docType, fileList] of filesToUpload) {
      for (const file of fileList) {
        // makePublic: false — these are candidate PII (Aadhar, PAN, bank
        // details); keep them restricted to this Shared Drive's members
        // rather than "anyone with the link", unlike resumes.
        const driveLink = await uploadFileToDrive(file.buffer, file.originalname, file.mimetype, record.documentsUploadFolderId, { makePublic: false });
        record.uploadedDocuments.push({
          docType,
          fileName: file.originalname,
          driveLink,
          uploadedAt: new Date(),
        });
      }
    }

    await record.save();
    ok(res, { uploadedDocuments: record.uploadedDocuments });
  } catch (e) {
    console.error('[upload-documents] error:', e);
    err(res, 'Failed to upload documents');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/assessments/:kind/send  (kind = excel|disc)
// HR-triggered — emails the candidate a signed link to the public
// assessment page. Reuses the interview-confirm signing pattern with `kind`
// standing in for the roundId slot, and a dedicated 'assessment' purpose so
// this link can't be reconstructed from any interview-confirm/feedback link
// already issued for the same record.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/assessments/:kind/send', async (req, res) => {
  try {
    const { kind } = req.params;
    if (!['excel', 'disc'].includes(kind)) return err(res, 'Unknown assessment type', 400);
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (!record.email) return err(res, 'This candidate has no email on file.', 400);

    const sig = signInterviewConfirm(String(record._id), kind, 'assessment');
    const link = `${FRONTEND_URL}/candidate-assessment/${record._id}/${kind}?sig=${sig}`;
    const label = kind === 'excel' ? 'Excel Test' : 'DISC Assessment';

    await sendMail({
      to: record.email,
      subject: `${label} — ${record.full_name}`,
      html: `<p>Dear ${record.full_name},</p><p>Please complete your ${label} using the link below:</p><p><a href="${link}">${link}</a></p>`,
    });

    if (kind === 'excel') {
      record.excelTest.sentAt = new Date();
      record.excelTest.status = 'Sent';
    } else {
      record.discAssessment.sentAt = new Date();
      record.discAssessment.status = 'Sent';
    }
    addEvent(record, `assessment-${kind}-sent`, `${label} Sent`);
    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error('[assessments/send] error:', e);
    err(res, 'Failed to send assessment');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applicant-records/:id/assessments/:kind/context?sig=...
// Public, unauthenticated — feeds the candidate's assessment page.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/assessments/:kind/context', async (req, res) => {
  try {
    const { kind } = req.params;
    const { sig } = req.query;
    if (!['excel', 'disc'].includes(kind)) return err(res, 'Unknown assessment type', 400);
    if (!verifyInterviewConfirm(req.params.id, kind, sig, 'assessment')) {
      return err(res, "This link couldn't be verified.", 403);
    }
    const record = await ApplicantRecord.findById(req.params.id).lean();
    if (!record) return err(res, 'Record not found', 404);

    if (kind === 'excel') {
      ok(res, {
        full_name: record.full_name,
        questions: EXCEL_QUESTIONS,
        status: record.excelTest?.status || '',
        answers: record.excelTest?.answers || [],
      });
    } else {
      ok(res, {
        full_name: record.full_name,
        questions: DISC_QUESTIONS,
        status: record.discAssessment?.status || '',
      });
    }
  } catch (e) {
    console.error('[assessments/context] error:', e);
    err(res, 'Failed to load the assessment');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/assessments/:kind/submit?sig=...
// Public, unauthenticated — the candidate's assessment page submits here.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/assessments/:kind/submit', async (req, res) => {
  try {
    const { kind } = req.params;
    const { sig } = req.query;
    if (!['excel', 'disc'].includes(kind)) return err(res, 'Unknown assessment type', 400);
    if (!verifyInterviewConfirm(req.params.id, kind, sig, 'assessment')) {
      return err(res, "This link couldn't be verified.", 403);
    }
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    if (kind === 'excel') {
      const { answers } = req.body; // array of strings, same order as EXCEL_QUESTIONS
      if (!Array.isArray(answers)) return err(res, 'Answers are required.', 400);
      record.excelTest.answers = EXCEL_QUESTIONS.map((question, i) => ({ question, answer: answers[i] || '' }));
      record.excelTest.status = 'Submitted';
      addEvent(record, 'assessment-excel-submitted', 'Excel Test Submitted');
    } else {
      const { answers } = req.body; // array of 12 single-letter picks, same order as DISC_QUESTIONS
      if (!Array.isArray(answers) || answers.length !== DISC_QUESTIONS.length) {
        return err(res, 'All DISC answers are required.', 400);
      }
      const { scores, primary } = scoreDisc(answers);
      record.discAssessment.scores = scores;
      record.discAssessment.primary = primary;
      record.discAssessment.status = 'Completed';
      addEvent(record, 'assessment-disc-submitted', 'DISC Assessment Completed', `Primary: ${primary}`);
    }

    await record.save();
    ok(res, { saved: true });
  } catch (e) {
    console.error('[assessments/submit] error:', e);
    err(res, 'Failed to submit assessment');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/assessments/excel/grade
// HR-triggered — marks each submitted answer correct/incorrect; score is
// derived from the marks, never auto-graded (free-text formula answers
// can't be reliably auto-graded).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/assessments/excel/grade', async (req, res) => {
  try {
    const { marks } = req.body; // array of booleans, same order as excelTest.answers
    if (!Array.isArray(marks)) return err(res, 'Marks are required.', 400);
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (!record.excelTest.answers.length) return err(res, 'No submitted answers to grade.', 400);

    record.excelTest.marks = marks;
    const correct = marks.filter(Boolean).length;
    record.excelTest.score = Math.round((correct / record.excelTest.answers.length) * 100);
    record.excelTest.status = 'Graded';
    addEvent(record, 'assessment-excel-graded', 'Excel Test Graded', `Score: ${record.excelTest.score}%`);

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error('[assessments/excel/grade] error:', e);
    err(res, 'Failed to grade the test');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applicant-records/:id/link-application
// Attaches a new CandidateApplication to an existing profile instead of
// creating a second one — the "link to existing" resolution of the
// duplicate-candidate check in routes/candidateApplications.js / referrals.js.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/link-application', async (req, res) => {
  try {
    const { applicationRef, position, date, source } = req.body;
    if (!applicationRef) return err(res, 'applicationRef is required.', 400);
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    record.applications.push({ position: position || '', date: date || new Date(), source: source || '', applicationRef });
    addEvent(record, `application-linked-${applicationRef}`, `Application Linked${position ? `: ${position}` : ''}`);
    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error('[link-application] error:', e);
    err(res, 'Failed to link application');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Offer letter — "Generate" renders an HTML preview from a template (no real
// PDF engine); HR can separately upload the actually-signed file via Drive.
// Not mutually exclusive — see offerLetterSchema comment in the model.
// ─────────────────────────────────────────────────────────────────────────────
function buildOfferLetterHtml(record) {
  const fd = record.finalDecision || {};
  const joiningDate = fd.joiningDate
    ? new Date(fd.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'to be confirmed';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; border: 1px solid #ddd;">
      <h2>Offer Letter</h2>
      <p>Dear ${record.full_name},</p>
      <p>We are pleased to offer you the position of <strong>${record.designation || 'the discussed role'}</strong> at Brisk Olive, with an annual CTC of <strong>${fd.offeredCTC || 'as discussed'}</strong>.</p>
      <p>Your tentative joining date is <strong>${joiningDate}</strong>.</p>
      <p>We look forward to having you on board.</p>
      <p>Regards,<br/>Brisk Olive HR Team</p>
    </div>
  `;
}

router.post('/:id/offer-letter/generate', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (record.finalDecision?.decision !== 'Offer Made') {
      return err(res, 'The Offer & Placement decision must be "Offer Made" before generating the Offer Letter.', 400);
    }

    record.finalDecision.offerLetter.source = 'generated';
    record.finalDecision.offerLetter.generatedHtml = buildOfferLetterHtml(record);
    record.finalDecision.offerLetter.updatedAt = new Date();
    addEvent(record, 'offer-letter-generated', 'Offer Letter Generated (Preview)');
    await record.save();
    ok(res, { offerLetter: record.finalDecision.offerLetter });
  } catch (e) {
    console.error('[offer-letter/generate] error:', e);
    err(res, 'Failed to generate offer letter');
  }
});

const uploadOfferLetter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

router.post('/:id/offer-letter/upload', uploadOfferLetter, async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);
    if (!req.file) return err(res, 'No file was selected.', 400);

    // Reuses the candidate's own Drive folder (created lazily here if this
    // is the very first upload of any kind for them) — same folder the
    // candidate's own document uploads land in.
    if (!record.documentsUploadFolderId) {
      const parentFolderId = process.env.GOOGLE_DRIVE_CANDIDATE_DOCS_PARENT_FOLDER_ID || process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;
      const folder = await createDriveFolder(`${record.full_name} - ${record._id}`, parentFolderId);
      record.documentsUploadFolderId = folder.id;
      record.documentsUploadFolderLink = folder.webViewLink;
    }

    // makePublic: false — an offer letter carries salary/CTC details.
    const driveLink = await uploadFileToDrive(req.file.buffer, req.file.originalname, req.file.mimetype, record.documentsUploadFolderId, { makePublic: false });

    record.finalDecision.offerLetter.source = 'uploaded';
    record.finalDecision.offerLetter.fileName = req.file.originalname;
    record.finalDecision.offerLetter.driveLink = driveLink;
    record.finalDecision.offerLetter.updatedAt = new Date();
    addEvent(record, 'offer-letter-uploaded', 'Offer Letter Uploaded', req.file.originalname);

    await record.save();
    ok(res, { offerLetter: record.finalDecision.offerLetter });
  } catch (e) {
    console.error('[offer-letter/upload] error:', e);
    err(res, 'Failed to upload offer letter');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applicant-records/:id/joining
// Post-acceptance tracking up to the candidate's actual first day — distinct
// from finalDecision.joiningDate (the originally planned date agreed at
// offer time). See joiningSchema comment in the model.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/joining', async (req, res) => {
  try {
    const record = await ApplicantRecord.findById(req.params.id);
    if (!record) return err(res, 'Record not found', 404);

    const { confirmedDate, actualDate, status, docsStatus, bgvStatus, remarks } = req.body;
    if (confirmedDate !== undefined) record.joining.confirmedDate = confirmedDate || null;
    if (actualDate    !== undefined) record.joining.actualDate    = actualDate || null;
    if (status        !== undefined) record.joining.status        = status;
    if (docsStatus    !== undefined) record.joining.docsStatus    = docsStatus;
    if (bgvStatus     !== undefined) record.joining.bgvStatus     = bgvStatus;
    if (remarks       !== undefined) record.joining.remarks       = remarks;

    if (status) {
      addEvent(record, 'joining-status', `Joining Status: ${status}`);
      if (status === 'Joined') record.status = 'Hired';
    }

    await record.save();
    ok(res, record.toObject());
  } catch (e) {
    console.error('[joining] error:', e);
    err(res, 'Failed to update joining details');
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