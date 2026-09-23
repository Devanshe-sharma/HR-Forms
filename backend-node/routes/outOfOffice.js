const express = require('express');
const router = express.Router();
const OutOfOffice = require('../models/OutOfOffice');
const Onboarding = require('../models/onboardingModel');
const Escalation = require('../models/Escalation');
const sendEscalationNotification = require('../emails/senders/sendEscalationNotification');
const { triggerOutOfOfficeNotice } = require('../emails');

// Mirrors the original Apps Script's "informed before/after event" check:
// >=24h ahead = advance, same-day-but-before-start = late, past start = later still.
function computeInformedStatus(eventDate, submittedAt) {
  const diffDays = (eventDate.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= 1) return { status: 'advance', label: 'Filled In Time (> 24 Hours In Advance)' };
  if (diffDays >= 0) return { status: 'late_before_start', label: 'Filled Late (less than 24 Hours Before Start Time)' };
  return { status: 'late_after_start', label: 'Filled Late (After Start Time)' };
}

// Fires only for a late-but-planned OOO entry — an automatic Timeliness
// escalation against the person who was out, same as if someone had logged
// it by hand from the Escalations page. Never throws past its own call site;
// the caller treats it as fire-and-forget so a failure here can't block the
// OOO entry itself from saving.
async function createLateOooEscalation(oooRecord) {
  if (!oooRecord.person?.employeeId) {
    console.warn(`[out-of-office] No employeeId on person "${oooRecord.person?.name}" — skipping auto-escalation.`);
    return;
  }

  const target = await Onboarding.findById(oooRecord.person.employeeId)
    .select('name dept designation officialEmail persEmail').lean();
  if (!target) {
    console.warn(`[out-of-office] Person Onboarding record not found (${oooRecord.person.employeeId}) — skipping auto-escalation.`);
    return;
  }

  // Raised By is always HR for this auto-escalation — never the OOO
  // submitter and never the person it's against — since it's HR's own late
  // filing policy being enforced, not a colleague's complaint. Falls back to
  // the target themselves only if the HR Onboarding record can't be resolved.
  const hrEmail = (process.env.HR_HEAD_EMAIL || '').toLowerCase();
  const hr = hrEmail
    ? await Onboarding.findOne({ $or: [{ officialEmail: hrEmail }, { persEmail: hrEmail }] })
        .select('name dept designation officialEmail persEmail').lean()
    : null;
  const creator = hr || target;

  const description = 'Out of Office filed late.';
  const doc = await Escalation.create({
    createdBy: {
      employeeId: creator._id,
      name: creator.name,
      email: creator.officialEmail || creator.persEmail || '',
      department: creator.dept || '',
      designation: creator.designation || '',
    },
    escalationFor: 'Employee',
    targetEmployees: [{
      employeeId: target._id,
      name: target.name,
      department: target.dept || '',
      designation: target.designation || '',
      email: target.officialEmail || target.persEmail || '',
    }],
    department: target.dept || '',
    category: 'T',
    categoryDescription: description,
    description,
    dateOccurred: oooRecord.startDateTime,
  });

  await Onboarding.updateMany({ _id: target._id }, { $inc: { escalationScore: -1 } });

  sendEscalationNotification(doc).catch(e =>
    console.error('[out-of-office] escalation notification mail failed:', e.message));
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
    const { submittedByEmail, submittedByName, person, startDateTime, upToDate, upToTime, reason, ccEmployees, plannedStatus, lateReason, unplannedKnownAt } = req.body;

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

    // Only a late filing (< 24h before start, or after it's already
    // started) asks the planned/not-planned question at all.
    let resolvedPlannedStatus = '';
    let resolvedLateReason = '';
    let resolvedUnplannedKnownAt = null;
    if (status !== 'advance') {
      if (!['Planned', 'Not Planned'].includes(plannedStatus)) {
        return res.status(400).json({ success: false, message: 'This was filed late — select whether it was planned or not.' });
      }
      resolvedPlannedStatus = plannedStatus;
      if (plannedStatus === 'Not Planned') {
        if (!lateReason?.trim()) {
          return res.status(400).json({ success: false, message: 'Enter why this was filed late.' });
        }
        if (!unplannedKnownAt) {
          return res.status(400).json({ success: false, message: 'Enter when this was decided.' });
        }
        const knownAtDate = new Date(unplannedKnownAt);
        if (Number.isNaN(knownAtDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid "when did you find out" date/time.' });
        }
        resolvedLateReason = lateReason.trim();
        resolvedUnplannedKnownAt = knownAtDate;
      }
    }

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
      plannedStatus: resolvedPlannedStatus,
      lateReason: resolvedLateReason,
      unplannedKnownAt: resolvedUnplannedKnownAt,
    });

    const saved = await record.save();

    await triggerOutOfOfficeNotice(saved);

    // Fire-and-forget — same convention as every other email/side-effect
    // trigger in this codebase: a failure here must never fail the OOO
    // entry that already saved successfully.
    if (resolvedPlannedStatus === 'Planned') {
      createLateOooEscalation(saved).catch(e =>
        console.error('[out-of-office] auto-escalation creation failed:', e.message));
    }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('Create out-of-office error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
