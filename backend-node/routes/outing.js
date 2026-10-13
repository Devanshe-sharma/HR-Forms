// routes/outing.js
const express = require('express');
const router = express.Router();
const Outing = require('../models/Outing');
const sendEmail = require('../emails/sendEmail'); // your email utility
const { sendOutingProposalUpdateEmail, buildOutingProposalUpdateMail } = require('../emails/emailOutingProposalUpdate');
const { buildQuarterlyOutingApprovalMail, buildSingleOutingApprovalMail } = require('../emails/emailQuarterlyOutingApproval');
const { buildUpcomingOutingReminderMail } = require('../emails/emailUpcomingOutingReminder');

// 1. CREATE new outing proposal (HR or Management)
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Required fields validation
    if (!data.topic?.trim()) return res.status(400).json({ error: 'Topic is required' });
    if (!data.description?.trim()) return res.status(400).json({ error: 'Description is required' });

    // Safe defaults
    data.proposedByRole = data.proposedByRole || 'HR';
    data.proposedByName = data.proposedByName || 'System User';
    data.proposedAt = new Date();
    data.priority = data.priority || 'P3'; // Prevent empty string

    // Set correct initial status
    if (data.proposedByRole === 'Management') {
      data.status = 'Suggested';
    } else {
      data.status = 'Proposed'; // HR default
    }

    const outing = new Outing(data);
    const saved = await outing.save();

    // Send email notification (optional – uncomment when ready)
    // if (data.status === 'Suggested') {
    //   await sendEmail({
    //     to: process.env.EMAIL_HR,
    //     subject: `New Outing Suggestion: ${saved.topic}`,
    //     html: `<p>Management suggested a new outing: ${saved.topic}</p><p>Check dashboard: ${process.env.FRONTEND_URL}/?tab=hr</p>`
    //   });
    // }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('Create outing error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. GET all outings (with filters)
router.get('/', async (req, res) => {
  try {
    const { status, quarter, financialYear, archived, outingName, category, limit = 20, page = 1 } = req.query;

    const filter = {};

    if (status) filter.status = { $in: status.split(',').map(s => s.trim()) };
    if (quarter) filter.quarter = quarter;
    if (financialYear) filter.financialYear = financialYear;
    if (outingName) filter.topic = { $regex: outingName, $options: 'i' };
    if (category) filter.category = category;
    if (archived === 'true') filter.status = 'Archived';
    if (archived === 'false') filter.status = { $ne: 'Archived' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const outings = await Outing.find(filter)
      .sort({ tentativeDate: -1, proposedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Outing.countDocuments(filter);

    res.json({
      success: true,
      count: outings.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: outings,
    });
  } catch (err) {
    console.error('Get outings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET single outing
router.get('/:id', async (req, res) => {
  try {
    const outing = await Outing.findById(req.params.id);
    if (!outing) return res.status(404).json({ success: false, error: 'Outing not found' });
    res.json({ success: true, data: outing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. UPDATE outing (HR/Management inline editing)
// In routes/outing.js PATCH handler
// PATCH update outing
router.patch('/:id', async (req, res) => {
  try {
    const oldOuting = await Outing.findById(req.params.id);
    if (!oldOuting) return res.status(404).json({ success: false, error: 'Outing not found' });

    const updated = await Outing.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Check if status changed OR remark/reason was added
    const statusChanged = req.body.status && req.body.status !== oldOuting.status;
    const hasRemarkOrReason = req.body.remark || req.body.reason;

    // Automatic update email disabled 2026-10-13 ("do not send any mail" —
    // all outing mail is now manual-only via /:id/mail/update/send etc.).
    // if (statusChanged || hasRemarkOrReason) {
    //   try {
    //     await sendOutingProposalUpdateEmail(updated._id);
    //     console.log(`Update email sent for outing: ${updated.topic} (status changed or remark added)`);
    //   } catch (emailErr) {
    //     console.error('Failed to send update email:', emailErr);
    //   }
    // }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Patch error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. DELETE outing (optional – use with caution)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Outing.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Outing not found' });
    res.json({ success: true, message: 'Outing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. SUBMIT FEEDBACK for outing
router.post('/:id/feedback', async (req, res) => {
  try {
    const outing = await Outing.findById(req.params.id);
    if (!outing) return res.status(404).json({ success: false, error: 'Outing not found' });

    outing.feedbacks.push({
      employeeName: req.body.employeeName,
      department: req.body.department,
      designation: req.body.designation,
      attended: req.body.attended,
      overallRating: Number(req.body.overallRating),
      contentQuality: Number(req.body.contentQuality),
      whatWasMissing: req.body.whatWasMissing?.trim() || undefined,
      howHelpful: req.body.howHelpful?.trim() || undefined,
      submittedAt: new Date(),
    });

    await outing.save();
    res.json({ success: true, message: 'Feedback submitted' });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Management suggestion endpoint (optional – if separate from main POST)
router.post('/suggest', async (req, res) => {
  try {
    const data = req.body;
    data.proposedByRole = 'Management';
    data.status = 'Suggested';
    data.priority = data.priority || 'P3';

    const outing = new Outing(data);
    const saved = await outing.save();

    // Optional: send instant notification to HR
    // await sendEmail({ to: process.env.EMAIL_HR, subject: `New Suggestion: ${saved.topic}`, html: '...' });

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 8. Manual mail preview & send — proposal update (per outing)
router.get('/:id/mail/update/preview', async (req, res) => {
  try {
    const mail = await buildOutingProposalUpdateMail(req.params.id);
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/mail/update/send', async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    if (!to?.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required' });

    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Send failed' });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 8b. Manual mail preview & send — single-outing approval request (per outing)
router.get('/:id/mail/single-approval/preview', async (req, res) => {
  try {
    const mail = await buildSingleOutingApprovalMail(req.params.id);
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/mail/single-approval/send', async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    if (!to?.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required' });

    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Send failed' });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 9. Manual mail preview & send — 2-week reminder (per outing)
router.get('/:id/mail/reminder/preview', async (req, res) => {
  try {
    const mail = await buildUpcomingOutingReminderMail(req.params.id);
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/mail/reminder/send', async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    if (!to?.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required' });

    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Send failed' });

    await Outing.updateOne({ _id: req.params.id }, { $set: { reminder2WeeksSent: true } });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 10. Manual mail preview & send — quarterly approval digest (page-level, not per outing)
router.get('/mail/quarterly-approval/preview', async (req, res) => {
  try {
    const mail = await buildQuarterlyOutingApprovalMail();
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/mail/quarterly-approval/send', async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    if (!to?.trim()) return res.status(400).json({ success: false, error: 'Recipient (To) is required' });
    if (!subject?.trim()) return res.status(400).json({ success: false, error: 'Subject is required' });

    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Send failed' });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;