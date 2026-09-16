const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const SalaryRevisionMailDraft = require('../models/SalaryRevisionMailDraft');
const sendEmail = require('../emails/sendEmail');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../config/roles');
const { SALARY_REVISION_MAILS_ENABLED } = require('../utils/salaryRevisionMailGate');

// Every Salary Revision mail lands here as an editable draft instead of
// being sent automatically (see utils/salaryRevisionMailQueue.js and each
// sender in emails/senders/). This router is HR's "Mail Queue" — list,
// edit, send, or discard a draft. Only HR/Admin may touch it; a Manager or
// Management logging in has no reason to see mail this app is about to
// send on HR's behalf.
const MAIL_QUEUE_ROLES = ['Admin', 'HR'];

// ─── GET /api/salary-revision-mail-drafts ────────────────────────────────
// ?status=draft|sent|discarded (default 'draft'); pass status=all for the
// full history. ?revisionId=<id> narrows to the mails belonging to one
// specific revision — used by the inline "Send Mail" buttons on the
// revision detail view (each Manager/Management/HR step shows only the
// mail(s) queued for that step, not the whole queue). ?unassigned=true
// instead narrows to mails that aren't about any single revision at all
// (currently just the quarterly due digest, which spans many employees)
// — used by the small company-wide mail button on the dashboard, since
// those have nowhere else to show up now that there's no global queue.
router.get('/', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const status = req.query.status || 'draft';
  const filter = status === 'all' ? {} : { status };
  if (req.query.unassigned === 'true') filter.revisionId = null;
  else if (req.query.revisionId) filter.revisionId = req.query.revisionId;
  const drafts = await SalaryRevisionMailDraft.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: drafts });
}));

// ─── PUT /api/salary-revision-mail-drafts/:id ────────────────────────────
// HR editing To/Cc/Bcc, subject, and body before sending. Only while
// still a draft — a sent or discarded mail is a historical record, not
// something to quietly rewrite after the fact.
router.put('/:id', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const draft = await SalaryRevisionMailDraft.findById(req.params.id);
  if (!draft) return res.status(404).json({ success: false, message: 'Mail draft not found' });
  if (draft.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Cannot edit — this draft is already '${draft.status}'` });
  }

  const { to, cc, bcc, subject, html } = req.body;
  if (to != null) draft.to = to;
  if (cc != null) draft.cc = cc;
  if (bcc != null) draft.bcc = bcc;
  if (subject != null) draft.subject = subject;
  if (html != null) draft.html = html;
  await draft.save();

  res.status(200).json({ success: true, data: draft });
}));

// ─── POST /api/salary-revision-mail-drafts/:id/send ──────────────────────
// The ONLY place any Salary Revision mail actually leaves this app.
// Gated behind SALARY_REVISION_MAILS_ENABLED as an extra safety backstop
// on top of "only HR can reach this route at all" — set it to 'true' in
// .env once ready to let sends actually go out.
router.post('/:id/send', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  if (!SALARY_REVISION_MAILS_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Salary Revision mail sending is currently disabled (SALARY_REVISION_MAILS_ENABLED is not "true" in .env).',
    });
  }

  const draft = await SalaryRevisionMailDraft.findById(req.params.id);
  if (!draft) return res.status(404).json({ success: false, message: 'Mail draft not found' });
  if (draft.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Cannot send — this draft is already '${draft.status}'` });
  }

  const result = await sendEmail({
    to: draft.to, cc: draft.cc || undefined, bcc: draft.bcc || undefined,
    subject: draft.subject, html: draft.html,
  });
  if (!result.success) {
    return res.status(502).json({ success: false, message: result.error?.message || 'Send failed' });
  }

  draft.status = 'sent';
  draft.sentAt = new Date();
  draft.sentBy = req.headers['x-user-name'] || req.user?.name || 'HR';
  await draft.save();

  res.status(200).json({ success: true, data: draft });
}));

// ─── POST /api/salary-revision-mail-drafts/:id/discard ───────────────────
router.post('/:id/discard', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const draft = await SalaryRevisionMailDraft.findById(req.params.id);
  if (!draft) return res.status(404).json({ success: false, message: 'Mail draft not found' });
  if (draft.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Cannot discard — this draft is already '${draft.status}'` });
  }

  draft.status = 'discarded';
  await draft.save();

  res.status(200).json({ success: true, data: draft });
}));

module.exports = router;
