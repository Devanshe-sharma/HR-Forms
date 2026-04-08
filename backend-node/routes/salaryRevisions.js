const express      = require('express');
const router       = express.Router();
const SalaryRevision = require('../models/SalaryRevision');
const asyncHandler = require('express-async-handler');

// ─── Helper ───────────────────────────────────────────────────────────────────

const caller = (req) => req.headers['x-user-name'] || 'System';

// ─── GET /api/salary-revisions ────────────────────────────────────────────────
// Returns all revisions sorted newest first.
// Frontend reads: Array<SalaryRevision> or { data: Array<SalaryRevision> }
// We return a plain array so the frontend Array.isArray() check passes.

router.get('/', asyncHandler(async (req, res) => {
  const revisions = await SalaryRevision.find().sort({ createdAt: -1 });
  res.status(200).json(revisions);
}));

// ─── GET /api/salary-revisions/:id ───────────────────────────────────────────

router.get('/:id', asyncHandler(async (req, res) => {
  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }
  res.status(200).json({ success: true, data: revision });
}));

// ─── POST /api/salary-revisions ──────────────────────────────────────────────
// Called by AddRevisionModal.
//
// Frontend payload (from AddRevisionModal.submit):
// {
//   employeeCode   : sel.employee_id,
//   employeeName   : sel.full_name,
//   department     : sel.department,
//   designation    : sel.designation,
//   email          : sel.email,
//   joiningDate    : sel.joining_date,
//   category       : cat,
//   applicableDate : appDate | null,
//   previousCtc    : sel.annual_ctc,
//   pmsScores      : [{ period, score }],
// }
//
// Response must have .success + .data so handleAdded() works.

router.post('/', asyncHandler(async (req, res) => {
  const {
    employeeCode,
    employeeName,
    department,
    designation,
    email,
    joiningDate,
    category,
    applicableDate,
    previousCtc,
    pmsScores,
  } = req.body;

  // Validate required fields upfront for cleaner error messages
  if (!employeeCode || !employeeName || !department || !designation || !email || !joiningDate || previousCtc == null) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeCode, employeeName, department, designation, email, joiningDate, previousCtc',
    });
  }

  const user = caller(req);

  // Build document — include BOTH old (snake_case) and new (camelCase) audit field
  // names so this works whether the old or new schema version is deployed on the server.
  const docData = {
    employeeCode,
    employeeName,
    department,
    designation,
    email,
    joiningDate   : new Date(joiningDate),
    category      : category || 'Employee',
    applicableDate: applicableDate ? new Date(applicableDate) : null,
    previousCtc   : Number(previousCtc),
    pmsScores     : Array.isArray(pmsScores) ? pmsScores.filter(p => p.period && p.period.trim()) : [],
    stage         : 'pending_manager',
    // Old schema used snake_case required fields — include them so validation passes
    created_by    : user,
    updated_by    : user,
    // New schema uses camelCase
    createdBy     : user,
    updatedBy     : user,
    // Old schema also had flat decision/status fields — set safe defaults
    decision              : 'Increment',
    status                : 'Draft',
    final_increment_percentage: 0,
    manager_recommendation    : 0,
    management_recommendation : 0,
    new_ctc               : Number(previousCtc),
    applicable_date       : applicableDate ? new Date(applicableDate) : new Date(),
  };

  try {
    const revision = new SalaryRevision(docData);
    await revision.save();
    return res.status(201).json({ success: true, data: revision });
  } catch (saveErr) {
    // Log the real Mongoose error so you can see exactly what field failed
    console.error('SalaryRevision save error:', saveErr.message);
    if (saveErr.errors) {
      Object.entries(saveErr.errors).forEach(([field, err]) => {
        console.error(`  Field "${field}": ${err.message}`);
      });
    }
    return res.status(500).json({
      success: false,
      message: saveErr.message,
      fields : saveErr.errors ? Object.keys(saveErr.errors) : [],
    });
  }
}));

// ─── PUT /api/salary-revisions/:id/manager ───────────────────────────────────
// Called by RevisionDetailView.postManager()
//
// Frontend payload:
// {
//   decision         : 'increment' | 'pip',
//   reason           : string,
//   pmsScores        : [{ period, score }],
//
//   // if increment:
//   recommendedPct   : number,
//
//   // if pip:
//   pipDurationMonths: number,
//   pipNewDueDate    : 'YYYY-MM-DD' | null,
// }
//
// After this call: stage moves to 'pending_management'
// For PIP: also set reviewDate = pipNewDueDate

router.put('/:id/manager', asyncHandler(async (req, res) => {
  const {
    decision,
    reason,
    pmsScores,
    // increment fields
    recommendedPct,
    // pip fields
    pipDurationMonths,
    pipNewDueDate,
    // also allow updating top-level editable fields
    applicableDate,
    category,
  } = req.body;

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }

  if (revision.stage !== 'pending_manager') {
    return res.status(400).json({
      success: false,
      message: `Cannot submit manager decision — current stage is '${revision.stage}'`,
    });
  }

  if (!decision || !['increment', 'pip'].includes(decision)) {
    return res.status(400).json({ success: false, message: "decision must be 'increment' or 'pip'" });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'reason is required' });
  }

  // Update PMS scores if provided
  if (Array.isArray(pmsScores)) {
    revision.pmsScores = pmsScores.filter(p => p.period && p.period.trim());
  }

  // Update editable employee-level fields
  if (applicableDate !== undefined) revision.applicableDate = applicableDate ? new Date(applicableDate) : null;
  if (category)                     revision.category = category;

  // Manager decision sub-document
  revision.managerDecision = {
    decision,
    reason        : reason.trim(),
    recommendedPct: decision === 'increment' ? (Number(recommendedPct) || 0) : null,
    pipDurationMonths: decision === 'pip' ? (Number(pipDurationMonths) || null) : null,
    pipNewDueDate : decision === 'pip' && pipNewDueDate ? new Date(pipNewDueDate) : null,
    submittedAt   : new Date(),
  };

  // Advance stage
  revision.stage = 'pending_management';

  // For PIP: set reviewDate so HR panel can show it
  if (decision === 'pip' && pipNewDueDate) {
    revision.reviewDate = new Date(pipNewDueDate);
  }

  revision.updatedBy = caller(req);
  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'Manager decision saved' });
}));

// ─── PUT /api/salary-revisions/:id/management ────────────────────────────────
// Called by RevisionDetailView.postManagement()
//
// Frontend payload:
// {
//   reason     : string,
//
//   // if manager chose increment:
//   finalPct   : number,
//
//   // if manager chose pip:
//   pipApproved: boolean,
// }
//
// After this call:
//   - Increment path  → stage = 'pending_hr'
//   - PIP approved    → stage = 'on_hold'
//   - PIP re-evaluate → stage = 'pending_manager' (send it back)

router.put('/:id/management', asyncHandler(async (req, res) => {
  const { reason, finalPct, pipApproved } = req.body;

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }

  if (revision.stage !== 'pending_management') {
    return res.status(400).json({
      success: false,
      message: `Cannot submit management decision — current stage is '${revision.stage}'`,
    });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'reason is required' });
  }

  const mgrDecision = revision.managerDecision?.decision;

  revision.managementDecision = {
    reason     : reason.trim(),
    finalPct   : mgrDecision === 'increment' ? (Number(finalPct) || 0) : null,
    pipApproved: mgrDecision === 'pip' ? Boolean(pipApproved) : null,
    submittedAt: new Date(),
  };

  // Determine next stage
  if (mgrDecision === 'increment') {
    // Increment path — always goes to HR for finalisation
    revision.stage = 'pending_hr';
    // Pre-fill finalIncrementPct so HR can see it immediately
    revision.finalIncrementPct = Number(finalPct) || 0;
    // Pre-calculate newCtc so it shows in HR panel
    revision.newCtc = Math.round(revision.previousCtc * (1 + (Number(finalPct) || 0) / 100));
  } else {
    // PIP path
    if (pipApproved) {
      revision.stage = 'on_hold'; // PIP approved — employee goes on hold
    } else {
      // Not approved → send back to manager for re-evaluation
      revision.stage = 'pending_manager';
      revision.managerDecision = {
        decision         : null,
        recommendedPct   : null,
        pipDurationMonths: null,
        pipNewDueDate    : null,
        reason           : '',
        submittedAt      : null,
      };
    }
  }

  revision.updatedBy = caller(req);
  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'Management decision saved' });
}));

// ─── PUT /api/salary-revisions/:id/hr ────────────────────────────────────────
// Called by RevisionDetailView.postHr()
//
// Frontend payload:
// {
//   notes         : string,
//   applicableDate: 'YYYY-MM-DD' | null,
//   newCtc        : number,
// }
//
// After this call: stage = 'completed'

router.put('/:id/hr', asyncHandler(async (req, res) => {
  const { notes, applicableDate, newCtc } = req.body;

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }

  if (revision.stage !== 'pending_hr') {
    return res.status(400).json({
      success: false,
      message: `Cannot submit HR decision — current stage is '${revision.stage}'`,
    });
  }

  const finalCtc = Number(newCtc) || revision.newCtc || revision.previousCtc;
  const appDate  = applicableDate ? new Date(applicableDate) : revision.applicableDate;

  revision.hrDecision = {
    newCtc        : finalCtc,
    applicableDate: appDate,
    notes         : (notes || '').trim(),
    submittedAt   : new Date(),
  };

  // Persist final values at top level for easy querying
  revision.newCtc           = finalCtc;
  revision.applicableDate   = appDate;
  revision.finalIncrementPct = revision.managementDecision?.finalPct ?? revision.finalIncrementPct ?? 0;
  revision.stage            = 'completed';
  revision.updatedBy        = caller(req);

  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'Revision finalised successfully' });
}));

// ─── DELETE /api/salary-revisions/:id ────────────────────────────────────────

router.delete('/:id', asyncHandler(async (req, res) => {
  const revision = await SalaryRevision.findByIdAndDelete(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }
  res.status(200).json({ success: true, data: revision, message: 'Deleted successfully' });
}));

module.exports = router;