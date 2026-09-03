const express = require('express');
const router = express.Router();
const OutOfOffice = require('../models/OutOfOffice');
const { triggerOutOfOfficeNotice, triggerOutOfOfficeManagerApproval } = require('../emails');
const resolveManagerContact = require('../utils/resolveManagerContact');
const { verifyOutOfOfficeAction } = require('../utils/outOfOfficeMailSigning');
const sendOutOfOfficeDecision = require('../emails/senders/sendOutOfOfficeDecision');

// Mirrors the original Apps Script's "informed before/after event" check:
// >=24h ahead = advance, same-day-but-before-start = late, past start = later still.
function computeInformedStatus(eventDate, submittedAt) {
  const diffDays = (eventDate.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= 1) return { status: 'advance', label: 'Filled In Time (> 24 Hours In Advance)' };
  if (diffDays >= 0) return { status: 'late_before_start', label: 'Filled Late (less than 24 Hours Before Start Time)' };
  return { status: 'late_after_start', label: 'Filled Late (After Start Time)' };
}

router.get('/', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const records = await OutOfOffice.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('Get out-of-office error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { submittedByEmail, submittedByName, person, startDateTime, upToDate, upToTime, reason, ccEmployees } = req.body;

    if (!person?.name || !person?.email) {
      return res.status(400).json({ success: false, message: 'Person out of office is required' });
    }
    if (!startDateTime) {
      return res.status(400).json({ success: false, message: 'Out of office date and start time is required' });
    }
    if (!upToTime) {
      return res.status(400).json({ success: false, message: 'Time up to is required' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    const eventDate = new Date(startDateTime);
    if (Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid out of office date/time' });
    }

    if (upToDate) {
      const upToDateTime = new Date(`${upToDate}T${upToTime}:00`);
      if (Number.isNaN(upToDateTime.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid time up to date' });
      }
      if (upToDateTime <= eventDate) {
        return res.status(400).json({ success: false, message: 'Time up to must be after the start date and time' });
      }
    }

    const submittedAt = new Date();
    const { status, label } = computeInformedStatus(eventDate, submittedAt);
    const manager = await resolveManagerContact({ onboardingId: person.employeeId });

    const record = new OutOfOffice({
      submittedByEmail: submittedByEmail || '',
      submittedByName: submittedByName || '',
      person,
      startDateTime: eventDate,
      upToDate: upToDate || '',
      upToTime,
      reason: reason.trim(),
      ccEmployees: Array.isArray(ccEmployees) ? ccEmployees : [],
      informedStatus: status,
      informedLabel: label,
      manager: { name: manager.name || '', email: manager.email || '' },
    });

    const saved = await record.save();

    await triggerOutOfOfficeNotice(saved);
    await triggerOutOfOfficeManagerApproval(saved);

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('Create out-of-office error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── GET /api/out-of-office/:id/mail-action ──────────────────────────────────
// Public, unauthenticated — feeds the manager's mail-action form
// (frontend/src/pages/outsider/OutOfOfficeAction.tsx) with what it needs to
// render, and whether the link is still actionable (it may have already been
// used, or actioned from the dashboard).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/mail-action', async (req, res) => {
  try {
    const { sig } = req.query;
    if (!verifyOutOfOfficeAction(req.params.id, sig)) {
      return res.status(403).json({ success: false, message: "This link couldn't be verified." });
    }

    const record = await OutOfOffice.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Out-of-office request not found' });

    res.json({
      success: true,
      data: {
        personName: record.person.name,
        startDateTime: record.startDateTime,
        upToDate: record.upToDate,
        upToTime: record.upToTime,
        reason: record.reason,
        managerName: record.manager?.name,
        approvalStatus: record.approval.status,
        actionable: record.approval.status === 'pending',
      },
    });
  } catch (err) {
    console.error('Out-of-office mail-action lookup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/out-of-office/:id/mail-action ─────────────────────────────────
// Public, unauthenticated submit — the manager's approve/reject decision
// from the email. A reason is required when rejecting.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/mail-action', async (req, res) => {
  try {
    const { sig, decision, reason } = req.body;
    if (!verifyOutOfOfficeAction(req.params.id, sig)) {
      return res.status(403).json({ success: false, message: "This link couldn't be verified." });
    }
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'A decision (approved/rejected) is required' });
    }
    if (decision === 'rejected' && !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'A reason is required to reject this request' });
    }

    const record = await OutOfOffice.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Out-of-office request not found' });
    if (record.approval.status !== 'pending') {
      return res.status(400).json({ success: false, message: `This request has already been ${record.approval.status}.` });
    }

    record.approval = {
      status: decision,
      reason: decision === 'rejected' ? reason.trim() : '',
      decidedAt: new Date(),
    };
    await record.save();

    sendOutOfOfficeDecision(record).catch((e) =>
      console.error('[out-of-office] decision notice mail failed:', e.message));

    res.json({ success: true, message: `Request ${decision}` });
  } catch (err) {
    console.error('Out-of-office mail-action submit error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
