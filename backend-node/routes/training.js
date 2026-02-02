// routes/training.js
const express = require('express');
const router = express.Router();
const Training = require('../models/Training');
const sendEmail = require('../utils/sendEmail');
const { sendUpcomingTrainingReminder } = require('../utils/emailUpcomingTraining');
 // adjust path if needed


router.get('/test-email', async (req, res) => {
  try {
    const result = await sendEmail({
      to: 'Software.developer@briskolive.com',
      subject: 'Test Email from HR Training System',
      html: `
        <h2>Hello from your app!</h2>
        <p>This is a test email sent using Nodemailer.</p>
        <p>Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        <hr>
        <small>If you received this → Nodemailer is working!</small>
      `,
    });

    if (result.success) {
      res.json({ success: true, message: 'Test email sent!' });
    } else {
      res.status(500).json({ success: false, error: result.error?.message || 'Email failed' });
    }
  } catch (err) {
    console.error('Test email route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// Manual trigger for 2-week training reminder (for testing)
router.post('/trigger-2week-reminder', async (req, res) => {
  try {
    const force = req.body.force === true || req.query.force === 'true';
    console.log(`Manually triggered 2-week reminder (force: ${force})`);

    const result = await sendUpcomingTrainingReminder();

    res.json({
      success: result.success,
      message: result.success ? '2-week reminder(s) sent!' : result.reason || result.error,
      details: result
    });
  } catch (err) {
    console.error('Trigger 2-week reminder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. CREATE new training / proposal / suggestion
router.post('/', async (req, res) => {
  try {
    console.log('[POST /training] Payload received:', req.body);

    const data = req.body;

    // Fallbacks for required fields (prevents validation crash during dev)
    if (!data.topic) data.topic = 'Untitled Training';
    if (!data.description) data.description = 'No description provided';
    if (!data.trainer?.name) {
      data.trainer = { ...data.trainer, name: 'To be assigned' };
    }

    // Auto-set defaults
    data.proposedByRole = data.proposedByRole || 'HR';
    data.proposedByName = data.proposedByName || 'System / Anonymous';
    data.proposedAt = new Date();

    if (!data.status) {
      data.status = data.proposedByRole === 'Management' ? 'Proposed' : 'Under Review';
    }

    const training = new Training(data);
    const saved = await training.save();

    res.status(201).json({
      success: true,
      data: saved
    });
  } catch (err) {
    console.error('[POST /training] ERROR:', err.message, err.stack);
    res.status(400).json({
      success: false,
      error: err.message || 'Validation or save failed',
      details: err.errors ? Object.keys(err.errors) : null
    });
  }
});

// 2. GET all trainings (with filters for tabs)
router.get('/', async (req, res) => {
  try {
    const { status, proposedByRole, priority, quarter, financialYear, limit = 20, page = 1 } = req.query;

    const filter = {};

    if (status) {
      filter.status = { $in: status.split(',').map(s => s.trim()) };
    }
    if (proposedByRole) filter.proposedByRole = proposedByRole;
    if (priority) filter.priority = priority;
    if (quarter) filter.quarter = quarter;
    if (financialYear) filter.financialYear = financialYear;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const trainings = await Training.find(filter)
      .sort({ trainingDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Training.countDocuments(filter);

    res.json({
      success: true,
      count: trainings.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: trainings
    });
  } catch (err) {
    console.error('[GET /training] ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET single training
router.get('/:id', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    res.json({ success: true, data: training });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. UPDATE training (used for inline editing)
router.patch('/:id', async (req, res) => {
  try {
    console.log(`[PATCH /training/${req.params.id}] Updates:`, req.body);

    const updated = await Training.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, // only update sent fields
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(`[PATCH /training/${req.params.id}] ERROR:`, err);
    res.status(400).json({
      success: false,
      error: err.message || 'Update failed',
      details: err.errors ? Object.keys(err.errors) : null
    });
  }
});

// 5. DELETE training (hard delete)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Training.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }
    res.json({ success: true, message: 'Training deleted permanently' });
  } catch (err) {
    console.error('[DELETE /training] ERROR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. ARCHIVE training (soft delete - preferred for audit trail)
router.patch('/:id/archive', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    training.status = 'Archived';
    training.archivedAt = new Date();
    await training.save();

    res.json({ success: true, data: training });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. SUBMIT FEEDBACK
// routes/training.js → post /:id/feedback
router.post('/:id/feedback', async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ success: false, error: 'Training not found' });
    }

    training.feedbacks.push({
      employeeName: req.body.employeeName || 'Anonymous',
      attended: req.body.attended ?? false,
      overallRating: req.body.overallRating ? Number(req.body.overallRating) : undefined,
      contentQuality: req.body.contentQuality ? Number(req.body.contentQuality) : undefined,
      whatWasMissing: req.body.whatWasMissing?.trim(),
      howHelpful: req.body.howHelpful?.trim(),
      suggestedTopics: req.body.suggestedTopics?.trim(),
      submittedAt: new Date()
    });

    await training.save();

    res.json({ success: true, message: 'Feedback submitted' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// routes/training.js or new suggestions.js
router.post('/suggestions', async (req, res) => {
  try {
    // Save suggestion (e.g., to a new Suggestion model or append to training)
    // For simplicity, just log or save somewhere
    console.log('New suggestion:', req.body.suggestion);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});


module.exports = router;

module.exports = router;