const express = require('express');
const router  = express.Router();

const Escalation = require('../models/Escalation');
const { CATEGORY_CODES } = require('../models/Escalation');
const Onboarding = require('../models/onboardingModel');
const { authenticate } = require('../middleware/authenticate');
const sendEscalationNotification = require('../emails/senders/sendEscalationNotification');

function validateEscalationFields(body) {
  const { escalationFor, targetEmployees, department, reportedBy, category, description, dateOccurred } = body;

  if (!['Employee', 'External', 'BO'].includes(escalationFor)) {
    return 'Select who this escalation is for.';
  }
  if (escalationFor !== 'BO' && (!Array.isArray(targetEmployees) || targetEmployees.length === 0)) {
    return 'Select the employee this concerns.';
  }
  if (escalationFor === 'External' && !reportedBy?.trim()) {
    return 'Enter who reported this.';
  }
  if (!department) {
    return 'Select a department.';
  }
  if (!category || !CATEGORY_CODES.includes(category)) {
    return 'Select a valid category.';
  }
  if (!description?.trim()) {
    return 'Enter a description.';
  }
  if (!dateOccurred) {
    return 'Missing the date this occurred on.';
  }
  return null;
}

// POST /api/escalations — log a new escalation (Employee, External, or BO).
router.post('/', authenticate, async (req, res) => {
  try {
    const { createdBy, escalationFor, targetEmployees, department, reportedBy, company, project, event, category, description, dateOccurred, cc } = req.body;

    if (!createdBy?.employeeId || !createdBy?.name) {
      return res.status(400).json({ success: false, message: 'Creator information is missing.' });
    }
    const validationError = validateEscalationFields(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const doc = await Escalation.create({
      createdBy,
      escalationFor,
      targetEmployees: escalationFor === 'BO' ? [] : targetEmployees,
      department,
      reportedBy: escalationFor === 'External' ? (reportedBy || '') : '',
      company: escalationFor === 'External' ? (company || '') : '',
      project: project || '',
      event: event || '',
      category,
      description,
      dateOccurred,
      cc: Array.isArray(cc) ? cc.filter(Boolean) : [],
    });

    // Every escalation dings the employee(s) it concerns by 1 point —
    // a running conduct tally, unrelated to fmsScore's task tracking. No-op
    // for BO mode, where targetEmployees is empty.
    if (doc.targetEmployees.length) {
      await Onboarding.updateMany(
        { _id: { $in: doc.targetEmployees.map(t => t.employeeId) } },
        { $inc: { escalationScore: -1 } }
      );
    }

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

// Management and Admin see everything; everyone else only ever sees
// escalations they raised or that were raised against them — matched by
// email, not name (name isn't reliable for this: see onboardingroutes.js's
// eligible-employees scope=mine, where a Manager's login name didn't match
// their own full name as it appears elsewhere).
const FULL_VISIBILITY_ROLES = ['Management', 'Admin'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scopeToOwnEscalations(req) {
  const email = (req.user?.email || '').trim();
  const escaped = escapeRegex(email);
  return {
    $or: [
      { 'createdBy.email': { $regex: `^${escaped}$`, $options: 'i' } },
      { 'targetEmployees.email': { $regex: `^${escaped}$`, $options: 'i' } },
    ],
  };
}

function canViewEscalation(req, doc) {
  if (FULL_VISIBILITY_ROLES.includes(req.user?.role)) return true;
  const email = (req.user?.email || '').trim().toLowerCase();
  if (!email) return false;
  if ((doc.createdBy?.email || '').trim().toLowerCase() === email) return true;
  return (doc.targetEmployees || []).some(
    (t) => (t.email || '').trim().toLowerCase() === email
  );
}

// GET /api/escalations — dashboard list, newest first.
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, escalationFor, search } = req.query;

    const clauses = [];
    if (category)      clauses.push({ category });
    if (escalationFor) clauses.push({ escalationFor });
    if (search) {
      clauses.push({
        $or: [
          { caseNumber: { $regex: search, $options: 'i' } },
          { 'createdBy.name':    { $regex: search, $options: 'i' } },
          { 'targetEmployees.name': { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }
    if (!FULL_VISIBILITY_ROLES.includes(req.user?.role)) {
      clauses.push(scopeToOwnEscalations(req));
    }

    const filter = clauses.length ? { $and: clauses } : {};
    const data = await Escalation.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Escalation.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (!canViewEscalation(req, doc)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this escalation.' });
    }
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

    const { escalationFor, targetEmployees, department, reportedBy, company, project, event, category, description, dateOccurred, cc } = req.body;

    const validationError = validateEscalationFields(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const nextTargetEmployees = escalationFor === 'BO' ? [] : targetEmployees;

    // Keep escalationScore honest if who it concerns changes — undo the
    // point for anyone removed, apply it to anyone newly added.
    const oldIds = doc.targetEmployees.map(t => String(t.employeeId));
    const newIds = nextTargetEmployees.map(t => String(t.employeeId));
    const removed = oldIds.filter(id => !newIds.includes(id));
    const added = newIds.filter(id => !oldIds.includes(id));
    if (removed.length) await Onboarding.updateMany({ _id: { $in: removed } }, { $inc: { escalationScore: 1 } });
    if (added.length) await Onboarding.updateMany({ _id: { $in: added } }, { $inc: { escalationScore: -1 } });

    doc.escalationFor = escalationFor;
    doc.targetEmployees = nextTargetEmployees;
    doc.department = department;
    doc.reportedBy = escalationFor === 'External' ? (reportedBy || '') : '';
    doc.company = escalationFor === 'External' ? (company || '') : '';
    doc.project = project || '';
    doc.event = event || '';
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
