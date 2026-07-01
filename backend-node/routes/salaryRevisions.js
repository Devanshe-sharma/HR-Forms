const express      = require('express');
const router       = express.Router();
const SalaryRevision = require('../models/SalaryRevision');
const asyncHandler = require('express-async-handler');
const Onboarding   = require('../models/onboardingModel');

// ─── Helper ───────────────────────────────────────────────────────────────────

const caller = (req) => req.headers['x-user-name'] || 'System';

// ─── GET /api/salary-revisions ────────────────────────────────────────────────
// Returns all revisions sorted newest first. Note: this includes every
// revision ever made (history included) — the frontend picks out the latest
// one per employee for the dashboard table and treats the rest as history.

router.get('/', asyncHandler(async (req, res) => {
  const revisions = await SalaryRevision.find().sort({ createdAt: -1 });
  res.status(200).json(revisions);
}));

// ─── GET /api/salary-revisions/history/:employeeCode ─────────────────────────
// All revisions for one employee, newest first — used to show past history
// separately from whichever one is currently driving the dashboard.

router.get('/history/:employeeCode', asyncHandler(async (req, res) => {
  const revisions = await SalaryRevision.find({ employeeCode: req.params.employeeCode })
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: revisions });
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
// Frontend payload now also supports (all optional):
// {
//   onboardingId, previousDesignation, newDesignation,
//   previousReportingHead, newReportingHead,
// }
// designationChanged / reportingHeadChanged are derived, not sent directly.

router.post('/', asyncHandler(async (req, res) => {
  const {
    onboardingId,
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
    previousDesignation,
    newDesignation,
    previousReportingHead,
    newReportingHead,
  } = req.body;

  if (!employeeCode || !employeeName || !department || !designation || !email || !joiningDate || previousCtc == null) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: employeeCode, employeeName, department, designation, email, joiningDate, previousCtc',
    });
  }

  const user = caller(req);

  const designationChanged   = !!newDesignation && newDesignation !== (previousDesignation || designation);
  const reportingHeadChanged = !!newReportingHead && newReportingHead !== (previousReportingHead || '');

  const docData = {
    onboardingId: onboardingId || null,
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

    designationChanged,
    previousDesignation  : previousDesignation || designation || '',
    newDesignation        : designationChanged ? newDesignation : null,

    reportingHeadChanged,
    previousReportingHead : previousReportingHead || '',
    newReportingHead       : reportingHeadChanged ? newReportingHead : null,

    created_by    : user,
    updated_by    : user,
    createdBy     : user,
    updatedBy     : user,
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
// Manager can also propose a designation change and/or a reporting-head
// change here, independently of whether they pick increment or PIP.

router.put('/:id/manager', asyncHandler(async (req, res) => {
  const {
    decision,
    reason,
    pmsScores,
    recommendedPct,
    pipDurationMonths,
    pipNewDueDate,
    applicableDate,
    category,
    newDesignation,
    newReportingHead,
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

  if (Array.isArray(pmsScores)) {
    revision.pmsScores = pmsScores.filter(p => p.period && p.period.trim());
  }

  if (applicableDate !== undefined) revision.applicableDate = applicableDate ? new Date(applicableDate) : null;
  if (category)                     revision.category = category;

  // Designation change — independent toggle
  if (newDesignation !== undefined) {
    const changed = !!newDesignation && newDesignation !== revision.previousDesignation;
    revision.designationChanged = changed;
    revision.newDesignation = changed ? newDesignation : null;
  }

  // Reporting head change — independent toggle
  if (newReportingHead !== undefined) {
    const changed = !!newReportingHead && newReportingHead !== revision.previousReportingHead;
    revision.reportingHeadChanged = changed;
    revision.newReportingHead = changed ? newReportingHead : null;
  }

  revision.managerDecision = {
    decision,
    reason        : reason.trim(),
    recommendedPct: decision === 'increment' ? (Number(recommendedPct) || 0) : null,
    pipDurationMonths: decision === 'pip' ? (Number(pipDurationMonths) || null) : null,
    pipNewDueDate : decision === 'pip' && pipNewDueDate ? new Date(pipNewDueDate) : null,
    submittedAt   : new Date(),
  };

  revision.stage = 'pending_management';

  if (decision === 'pip' && pipNewDueDate) {
    revision.reviewDate = new Date(pipNewDueDate);
  }

  revision.updatedBy = caller(req);
  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'Manager decision saved' });
}));

// ─── PUT /api/salary-revisions/:id/management ────────────────────────────────

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

  if (mgrDecision === 'increment') {
    revision.stage = 'pending_hr';
    revision.finalIncrementPct = Number(finalPct) || 0;
    revision.newCtc = Math.round(revision.previousCtc * (1 + (Number(finalPct) || 0) / 100));
  } else {
    if (pipApproved) {
      revision.stage = 'on_hold';
    } else {
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
// Finalises the revision AND syncs the latest values back onto the
// Onboarding record — designation only if it actually changed, salary
// numbers always (even a "0% increment" finalization still confirms the
// current CTC as the latest figure), reporting head only if it changed.

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

  revision.newCtc           = finalCtc;
  revision.applicableDate   = appDate;
  revision.finalIncrementPct = revision.managementDecision?.finalPct ?? revision.finalIncrementPct ?? 0;
  revision.stage            = 'completed';
  revision.updatedBy        = caller(req);

  await revision.save();

  // ─── Sync latest values back onto the Onboarding record ────────────────
  // Onboarding is the dashboard's source of truth — it should always show
  // the CURRENT designation/salary, while this revision stays in history.
  try {
    const onboardingUpdate = {
      annualCtc: finalCtc,
      salApplicableFrom: appDate,
      salReviewStatus: 'Revised',
    };
    if (revision.designationChanged && revision.newDesignation) {
      onboardingUpdate.designation = revision.newDesignation;
    }
    if (revision.reportingHeadChanged && revision.newReportingHead) {
      onboardingUpdate.reportingHead = revision.newReportingHead;
    }

    const onboardingTarget = revision.onboardingId || revision.employeeCode;
    if (onboardingTarget) {
      await Onboarding.findByIdAndUpdate(onboardingTarget, { $set: onboardingUpdate });
    }
  } catch (syncErr) {
    // Don't fail the whole request if the sync-back has an issue — the
    // revision itself is already saved and correct; log for follow-up.
    console.error('Onboarding sync-back failed:', syncErr.message);
  }
  // ─────────────────────────────────────────────────────────────────────────

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