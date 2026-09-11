const express = require('express');
const router  = express.Router();

const Escalation = require('../models/Escalation');
const Onboarding = require('../models/onboardingModel');
const { authenticate } = require('../middleware/authenticate');
const sendEscalationNotification = require('../emails/senders/sendEscalationNotification');

// POST /api/escalations — log a new escalation (General or Department Related).
router.post('/', authenticate, async (req, res) => {
  try {
    const { createdBy, escalationFor, targetEmployees, category, description, dateOccurred, cc } = req.body;

    if (!createdBy?.employeeId || !createdBy?.name) {
      return res.status(400).json({ success: false, message: 'Creator information is missing.' });
    }
    if (!['Department Related', 'General'].includes(escalationFor)) {
      return res.status(400).json({ success: false, message: 'Select who this escalation is for.' });
    }
    if (!Array.isArray(targetEmployees) || targetEmployees.length === 0) {
      return res.status(400).json({ success: false, message: 'Select the employee this concerns.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Select a category.' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: 'Enter a description.' });
    }
    if (!dateOccurred) {
      return res.status(400).json({ success: false, message: 'Select the date this occurred on.' });
    }

    const doc = await Escalation.create({
      createdBy,
      escalationFor,
      targetEmployees,
      category,
      description,
      dateOccurred,
      cc: Array.isArray(cc) ? cc.filter(Boolean) : [],
    });

    // Every escalation dings the employee(s) it concerns by 1 point —
    // a running conduct tally, unrelated to fmsScore's task tracking.
    await Onboarding.updateMany(
      { _id: { $in: targetEmployees.map(t => t.employeeId) } },
      { $inc: { escalationScore: -1 } }
    );

    // Fire-and-forget — a mail failure must never fail the escalation
    // creation itself, same convention as every other email trigger in
    // this codebase (e.g. salary revision's senders in routes/salaryRevisions.js).
    sendEscalationNotification(doc).catch(e =>
      console.error('[escalations] notification mail failed:', e.message));

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('Escalation submission error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/escalations — dashboard list, newest first.
router.get('/', async (req, res) => {
  try {
    const { category, escalationFor, search } = req.query;

    const filter = {};
    if (category)      filter.category      = category;
    if (escalationFor) filter.escalationFor = escalationFor;
    if (search) {
      filter.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { 'createdBy.name':    { $regex: search, $options: 'i' } },
        { 'targetEmployees.name': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await Escalation.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await Escalation.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/escalations/:id — edit an existing escalation. Creator and case
// number are never editable here; only the classification fields are.
// No notification mail is sent on edit.
router.put('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Escalation.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    const { escalationFor, targetEmployees, category, description, dateOccurred, cc } = req.body;

    if (!['Department Related', 'General'].includes(escalationFor)) {
      return res.status(400).json({ success: false, message: 'Select who this escalation is for.' });
    }
    if (!Array.isArray(targetEmployees) || targetEmployees.length === 0) {
      return res.status(400).json({ success: false, message: 'Select the employee this concerns.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Select a category.' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: 'Enter a description.' });
    }
    if (!dateOccurred) {
      return res.status(400).json({ success: false, message: 'Select the date this occurred on.' });
    }

    // Keep escalationScore honest if who it concerns changes — undo the
    // point for anyone removed, apply it to anyone newly added.
    const oldIds = doc.targetEmployees.map(t => String(t.employeeId));
    const newIds = targetEmployees.map(t => String(t.employeeId));
    const removed = oldIds.filter(id => !newIds.includes(id));
    const added = newIds.filter(id => !oldIds.includes(id));
    if (removed.length) await Onboarding.updateMany({ _id: { $in: removed } }, { $inc: { escalationScore: 1 } });
    if (added.length) await Onboarding.updateMany({ _id: { $in: added } }, { $inc: { escalationScore: -1 } });

    doc.escalationFor = escalationFor;
    doc.targetEmployees = targetEmployees;
    doc.category = category;
    doc.description = description;
    doc.dateOccurred = dateOccurred;
    doc.cc = Array.isArray(cc) ? cc.filter(Boolean) : [];
    await doc.save();

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Escalation edit error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
