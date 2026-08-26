const express = require('express');
const router = express.Router();

const Grievance = require('../models/Grievance');
const { CATEGORY_TAXONOMY } = require('../models/Grievance');
const Onboarding = require('../models/onboardingModel');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../config/roles');

const HR_ROLES = ['HR', 'Management', 'Admin'];

// Grievances are confidential: only the person who filed one, and
// HR/Management, may ever see it — not the employee(s) it concerns.
// The JWT only carries the User's email/role, not their linked
// Onboarding _id, so for non-HR callers we resolve that link here
// server-side (same official/personal email fallback used elsewhere)
// rather than trusting a client-supplied employeeId.
async function resolveOwnEmployeeId(req) {
  const email = req.user?.email?.toLowerCase();
  if (!email) return null;
  const doc = await Onboarding.findOne({
    $or: [{ officialEmail: email }, { persEmail: email }],
  }).select('_id').lean();
  return doc ? String(doc._id) : null;
}

// POST /api/grievances — file a new grievance.
router.post('/', authenticate, async (req, res) => {
  try {
    const { filedBy, concerning, category, subcategory, description, severity } = req.body;

    if (!filedBy?.employeeId || !filedBy?.name) {
      return res.status(400).json({ success: false, message: 'Filer information is missing.' });
    }
    if (!Array.isArray(concerning) || concerning.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one employee this concerns.' });
    }
    if (!category || !CATEGORY_TAXONOMY[category]) {
      return res.status(400).json({ success: false, message: 'Select a valid category.' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: 'Describe what happened.' });
    }
    if (!['Low', 'Medium', 'Critical'].includes(severity)) {
      return res.status(400).json({ success: false, message: 'Select a severity level.' });
    }

    const doc = await Grievance.create({
      filedBy,
      concerning,
      category,
      subcategory: subcategory || '',
      description,
      severity,
      status: 'Open',
      timeline: [{ who: filedBy.name, note: 'Grievance filed.', statusAtTime: 'Open', when: new Date() }],
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('Grievance submission error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/grievances — HR/Management see everything; anyone else sees
// only grievances they personally filed.
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, severity, category, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { 'concerning.name': { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (!HR_ROLES.includes(req.user.role)) {
      const ownId = await resolveOwnEmployeeId(req);
      if (!ownId) return res.json({ success: true, data: [] });
      filter['filedBy.employeeId'] = ownId;
    }

    const data = await Grievance.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/grievances/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Grievance.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    if (!HR_ROLES.includes(req.user.role)) {
      const ownId = await resolveOwnEmployeeId(req);
      if (!ownId || String(doc.filedBy.employeeId) !== ownId) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this grievance.' });
      }
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/grievances/:id/updates — HR/Management add a note and,
// optionally, move the status forward.
router.post('/:id/updates', authenticate, requireRole(HR_ROLES), async (req, res) => {
  try {
    const { note, status } = req.body;
    if (!note?.trim()) return res.status(400).json({ success: false, message: 'Enter an update note.' });
    if (status && !['Open', 'In Progress', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const doc = await Grievance.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    if (status) doc.status = status;
    doc.timeline.push({ who: req.user.name, note, statusAtTime: status || doc.status, when: new Date() });
    await doc.save();

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
