const express = require('express');
const router  = express.Router();

const Escalation = require('../models/Escalation');
const { CATEGORY_CODES } = require('../models/Escalation');
const Onboarding = require('../models/onboardingModel');
const { authenticate } = require('../middleware/authenticate');
const sendEscalationNotification = require('../emails/senders/sendEscalationNotification');

function validateEscalationFields(body) {
  const { escalationFor, targetEmployees, department, reportedBy, category, categoryDescription, description, dateOccurred } = body;

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
  if (!categoryDescription?.trim()) {
    return 'Select or enter a category description.';
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
    const { createdBy, escalationFor, targetEmployees, department, reportedBy, company, project, event, category, categoryDescription, description, dateOccurred, cc } = req.body;

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
      categoryDescription,
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

// Every authenticated user can fetch and view every escalation — no
// per-role or per-person scoping on read. Editing is narrower: only
// whoever raised it can edit — not the person it's raised against, and
// not even Management/Admin (they can view and act via updates elsewhere,
// but not rewrite the original record).
function canEditEscalation(req, doc) {
  const email = (req.user?.email || '').trim().toLowerCase();
  if (!email) return false;
  return (doc.createdBy?.email || '').trim().toLowerCase() === email;
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
    if (!canEditEscalation(req, doc)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this escalation.' });
    }

    const { escalationFor, targetEmployees, department, reportedBy, company, project, event, category, categoryDescription, description, dateOccurred, cc } = req.body;

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
    doc.categoryDescription = categoryDescription;
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

// DELETE /api/escalations/:id — only the creator can delete their own
// escalation, same trust boundary as edit. Reverts the escalationScore
// point(s) it took off its target employee(s) before removing the doc —
// the point every other write path (create/edit) keeps in sync, but a raw
// DB deletion never would.
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const doc = await Escalation.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (!canEditEscalation(req, doc)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this escalation.' });
    }

    if (doc.targetEmployees.length) {
      await Onboarding.updateMany(
        { _id: { $in: doc.targetEmployees.map(t => t.employeeId) } },
        { $inc: { escalationScore: 1 } }
      );
    }

    await Escalation.deleteOne({ _id: doc._id });

    res.json({ success: true, message: `${doc.caseNumber} deleted.` });
  } catch (err) {
    console.error('Escalation delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
