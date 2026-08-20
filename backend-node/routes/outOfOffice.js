const express = require('express');
const router = express.Router();
const OutOfOffice = require('../models/OutOfOffice');
const { triggerOutOfOfficeNotice } = require('../emails');

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
    const { submittedByEmail, submittedByName, person, startDateTime, upToTime, reason, ccEmployees } = req.body;

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

    const submittedAt = new Date();
    const { status, label } = computeInformedStatus(eventDate, submittedAt);

    const record = new OutOfOffice({
      submittedByEmail: submittedByEmail || '',
      submittedByName: submittedByName || '',
      person,
      startDateTime: eventDate,
      upToTime,
      reason: reason.trim(),
      ccEmployees: Array.isArray(ccEmployees) ? ccEmployees : [],
      informedStatus: status,
      informedLabel: label,
    });

    const saved = await record.save();

    await triggerOutOfOfficeNotice(saved);

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('Create out-of-office error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
