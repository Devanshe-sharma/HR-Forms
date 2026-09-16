const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const ConfirmationMailDraft = require('../models/ConfirmationMailDraft');
const sendEmail = require('../emails/sendEmail');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../config/roles');
const { CONFIRMATION_MAILS_ENABLED } = require('../utils/confirmationMailGate');

// Every Confirmation mail lands here as an editable draft instead of
// being sent automatically (see utils/confirmationMailQueue.js and each
// sender in emails/senders/). This router is HR's "Mail Queue" for the
// Confirmations module — mirrors routes/salaryRevisionMailDrafts.js
// exactly, with its own separate model/kill-switch. Only HR/Admin may
// touch it.
const MAIL_QUEUE_ROLES = ['Admin', 'HR'];

// ─── GET /api/confirmation-mail-drafts ───────────────────────────────────
// ?status=draft|sent|discarded (default 'draft'); pass status=all for the
// full history. ?confirmationId=<id> narrows to the mails belonging to
// one specific confirmation record. ?unassigned=true narrows to mails
// that aren't about any single record at all (the quarterly digest).
router.get('/', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const status = req.query.status || 'draft';
  const filter = status === 'all' ? {} : { status };
  if (req.query.unassigned === 'true') filter.confirmationId = null;
  else if (req.query.confirmationId) filter.confirmationId = req.query.confirmationId;
  const drafts = await ConfirmationMailDraft.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: drafts });
}));

// ─── PUT /api/confirmation-mail-drafts/:id ───────────────────────────────
// HR editing To/Cc/Bcc, subject, and body before sending. Only while
// still a draft.
router.put('/:id', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const draft = await ConfirmationMailDraft.findById(req.params.id);
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

// ─── POST /api/confirmation-mail-drafts/:id/send ─────────────────────────
// The ONLY place any Confirmation mail actually leaves this app. Gated
// behind CONFIRMATION_MAILS_ENABLED — set it to 'true' in .env once ready
// to let sends actually go out.
router.post('/:id/send', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  if (!CONFIRMATION_MAILS_ENABLED) {
    return res.status(403).json({
      success: false,
      message: 'Confirmation mail sending is currently disabled (CONFIRMATION_MAILS_ENABLED is not "true" in .env).',
    });
  }

  const draft = await ConfirmationMailDraft.findById(req.params.id);
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

// ─── POST /api/confirmation-mail-drafts/:id/discard ──────────────────────
router.post('/:id/discard', authenticate, requireRole(MAIL_QUEUE_ROLES), asyncHandler(async (req, res) => {
  const draft = await ConfirmationMailDraft.findById(req.params.id);
  if (!draft) return res.status(404).json({ success: false, message: 'Mail draft not found' });
  if (draft.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Cannot discard — this draft is already '${draft.status}'` });
  }

  draft.status = 'discarded';
  await draft.save();

  res.status(200).json({ success: true, data: draft });
}));

module.exports = router;
