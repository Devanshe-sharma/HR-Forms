const express      = require('express');
const router       = express.Router();
const SalaryRevision = require('../models/SalaryRevision');
const asyncHandler = require('express-async-handler');
const Onboarding   = require('../models/onboardingModel');
const Confirmations = require('../models/Confirmations');
const { fiscalYearOf, fiscalQuarterOf } = require('../utils/fiscalQuarter');
const sendSalaryRevisionManagerRequest      = require('../emails/senders/sendSalaryRevisionManagerRequest');
const sendSalaryRevisionManagementApproval  = require('../emails/senders/sendSalaryRevisionManagementApproval');
const sendSalaryRevisionEmployeeConfirmation = require('../emails/senders/sendSalaryRevisionEmployeeConfirmation');
const sendSalaryRevisionPipHold             = require('../emails/senders/sendSalaryRevisionPipHold');
const resolveManagerContact = require('../utils/resolveManagerContact');
const { verifySalaryRevisionAction } = require('../utils/salaryRevisionMailSigning');
const isPpoConversion = require('../utils/isPpoConversion');

// ─── Helper ───────────────────────────────────────────────────────────────────

const caller = (req) => req.headers['x-user-name'] || 'System';

// ─── Shared decision-application logic ───────────────────────────────────────
// Used by both the authenticated dashboard routes below AND the public
// mail-action routes (manager/management filling in their decision straight
// from the request/approval/escalation email) — one place decides what a
// manager/management decision actually does to a revision, so the two entry
// points can never quietly diverge.

function applyManagerDecision(revision, { decision, reason, recommendedPct, pipDurationMonths, pipNewDueDate }) {
  if (!decision || !['increment', 'pip'].includes(decision)) {
    return "decision must be 'increment' or 'pip'";
  }
  if (!reason || !reason.trim()) return 'reason is required';

  revision.managerDecision = {
    decision,
    reason        : reason.trim(),
    recommendedPct: decision === 'increment' ? (Number(recommendedPct) || 0) : null,
    pipDurationMonths: decision === 'pip' ? (Number(pipDurationMonths) || null) : null,
    pipNewDueDate : decision === 'pip' && pipNewDueDate ? new Date(pipNewDueDate) : null,
    submittedAt   : new Date(),
  };
  revision.stage = 'pending_management';
  if (decision === 'pip' && pipNewDueDate) revision.reviewDate = new Date(pipNewDueDate);
  return null;
}

function applyManagementDecision(revision, { reason, finalPct, pipApproved }) {
  if (!reason || !reason.trim()) return 'reason is required';

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
  } else if (pipApproved) {
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
    // Reopened cycle — fresh response window, so it doesn't already
    // read as overdue from the original request date.
    revision.managerRequestedAt = new Date();
    revision.managerEscalationSentAt = null;
    revision.finalEscalationSentAt = null;
  }
  return null;
}

// ─── GET /api/salary-revisions ────────────────────────────────────────────────
// Returns all revisions sorted newest first. Note: this includes every
// revision ever made (history included) — the frontend picks out the latest
// one per employee for the dashboard table and treats the rest as history.

router.get('/', asyncHandler(async (req, res) => {
  const revisions = await SalaryRevision.find().sort({ createdAt: -1 });
  res.status(200).json(revisions);
}));

// ─── GET /api/salary-revisions/analytics/increments ──────────────────────────
// Increment stats for HR Dashboard: average increment %, employees with a
// low increment (<9%), and high performers (>20%) — filtered to one year at
// a time. "Year" for a revision is its applicableDate (when the new CTC
// actually kicks in), falling back to createdAt for older records that
// never had one set. Only 'completed' revisions with a real increment
// figure are considered — PIP revisions never set finalIncrementPct, so
// they're naturally excluded rather than counted as a 0% increment.
//
// Also excluded: revisions where the category changed from Intern/Contract
// Based to Employee. Converting off a stipend onto a full CTC structure
// produces a huge % jump that isn't a real merit increment — counting it
// would falsely inflate the average and stuff the High Performer bucket
// with conversions rather than actual raises.

const MAX_ANALYTIC_INCREMENT = 50;

router.get('/analytics/increments', asyncHandler(async (req, res) => {
  const raw = await SalaryRevision.find({
    stage: 'completed',
  }, 'employeeName employeeCode department designation finalIncrementPct applicableDate createdAt categoryChanged previousCategory newCategory').lean();
  const completed = raw
    .filter((r) => r.finalIncrementPct != null && !isPpoConversion(r) && r.finalIncrementPct <= MAX_ANALYTIC_INCREMENT);

  const yearOf = (r) => fiscalYearOf(r.applicableDate || r.createdAt);

  const availableYears = Array.from(new Set(completed.map(yearOf))).sort((a, b) => b - a);
  const year = parseInt(req.query.year, 10) || fiscalYearOf(new Date());

  const inYear = completed.filter((r) => yearOf(r) === year);

  // Multiple revisions for the same employee within the year are combined
  // before judging low/high — someone who got a 5% increment in one
  // revision and another 6% later the same year genuinely received ~11%
  // that year, and judging either revision on its own as "low" would be
  // misleading. employeeName/employeeCode are only used internally to
  // group revisions by person — this endpoint is aggregate-only, same
  // confidentiality rule as Asked-to-Leave/Referred/Offer Dropout: no
  // name, designation, salary figure (CTC), or other per-employee
  // identifier is ever included in what's actually sent back below.
  // designation is deliberately left out too — in a small department a
  // designation can narrow a row down to one specific person just as
  // easily as a name would.
  const byEmployee = new Map();
  for (const r of inYear) {
    const key = r.employeeCode || r.employeeName;
    const existing = byEmployee.get(key);
    if (existing) {
      existing.incrementPct += r.finalIncrementPct;
      existing.revisionCount += 1;
    } else {
      byEmployee.set(key, {
        department: r.department,
        incrementPct: r.finalIncrementPct,
        revisionCount: 1,
      });
    }
  }
  const perEmployee = Array.from(byEmployee.values()).map((e) => ({
    ...e,
    incrementPct: Math.round(e.incrementPct * 100) / 100,
  }));

  const lowIncrementList = perEmployee.filter((e) => e.incrementPct < 9)
    .sort((a, b) => a.incrementPct - b.incrementPct);
  const highPerformerList = perEmployee.filter((e) => e.incrementPct >= 20)
    .sort((a, b) => b.incrementPct - a.incrementPct);

  const avgIncrementPct = perEmployee.length
    ? Math.round((perEmployee.reduce((s, e) => s + e.incrementPct, 0) / perEmployee.length) * 10) / 10
    : null;

  // Quarterly trend stays per-revision (not per-employee-per-year) — it's
  // answering a different question: how large were the raises actually
  // handed out each quarter, not how each employee fared across the year.
  const quarters = [1, 2, 3, 4].map((q) => {
    const inQuarter = inYear.filter((r) => fiscalQuarterOf(r.applicableDate || r.createdAt) === q);
    const avg = inQuarter.length
      ? Math.round((inQuarter.reduce((s, r) => s + r.finalIncrementPct, 0) / inQuarter.length) * 10) / 10
      : null;
    return { quarter: `Q${q}`, total: inQuarter.length, avgIncrementPct: avg };
  });

  res.status(200).json({
    success: true,
    year,
    availableYears: availableYears.length ? availableYears : [year],
    total: perEmployee.length,
    avgIncrementPct,
    lowIncrementCount: lowIncrementList.length,
    lowIncrementList,
    highPerformerCount: highPerformerList.length,
    highPerformerList,
    quarters,
  });
}));

// ─── GET /api/salary-revisions/analytics/pip ──────────────────────────────────
// "% of employees who performed after PIP" for the HR Dashboard. Combines
// two sources of PIP-like events, since HR treats both as "on PIP":
//  - SalaryRevision: a formal PIP after confirmation, resolved via
//    PUT /:id/pip-outcome (improved / not_improved) once the review date
//    is reached — before that route existed, an approved PIP had no way
//    to close out at all.
//  - Confirmations: extended probation — Onboarding already labels this
//    "On PIP / Extended". No separate outcome field is needed there: it's
//    derivable from history containing an 'extended' entry plus whatever
//    currentStatus the record eventually reached ('confirmed' = improved,
//    'not_confirmed' = did not improve).
// "Currently on PIP" only counts SalaryRevision on_hold — that's what HR
// means day-to-day by "on PIP"; extended-probation cases already have
// their own "Extended" stat on the Confirmations dashboard.
//
// A revision left on_hold doesn't get touched by anything once the
// employee exits (there's no automatic cleanup), so an exited employee's
// stale on_hold record would otherwise count as "currently on PIP"
// forever — cross-check against Onboarding.exitStatus and drop those.
// Only works when onboardingId is actually linked: official emails aren't
// reliably unique (role-based addresses like "dme@..." get reassigned to
// whoever fills that role next), so matching by email would risk
// excluding a different, currently active employee who inherited an
// exited one's address. Revisions with no onboardingId are left as-is —
// those need a human to correct via the Edit dialog or PIP close-out.
const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

router.get('/analytics/pip', asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || fiscalYearOf(new Date());

  // No employeeName in the projection — this endpoint is aggregate-only,
  // same confidentiality rule as Exit's Asked-to-Leave metric. Only
  // reviewDate/stage/onboardingId are needed to compute the counts below.
  const srPipRecords = await SalaryRevision.find({
    'managerDecision.decision': 'pip',
    'managementDecision.pipApproved': true,
  }).select('stage pipOutcome pipOutcomeDate reviewDate onboardingId').lean();

  const onHold = srPipRecords.filter((r) => r.stage === 'on_hold');
  const exitedIds = new Set(
    (await Onboarding.find(
      { _id: { $in: onHold.map((r) => r.onboardingId).filter(Boolean) } }, 'exitStatus'
    ).lean())
      .filter((o) => EXITED_STATUS_VALUES.has(o.exitStatus || ''))
      .map((o) => String(o._id))
  );
  const currentlyOnPip = onHold.filter((r) => !exitedIds.has(String(r.onboardingId)));

  // Same "current employee" definition as Onboarding's Interns widget —
  // joined and not yet exited.
  const totalCurrentEmployees = await Onboarding.countDocuments({
    joiningStatus: 'Joined',
    exitStatus: { $nin: [...EXITED_STATUS_VALUES] },
  });
  const pipPct = totalCurrentEmployees > 0
    ? Math.round((currentlyOnPip.length / totalCurrentEmployees) * 1000) / 10
    : 0;

  const srResolved     = srPipRecords.filter((r) => r.pipOutcome === 'improved' || r.pipOutcome === 'not_improved');
  const srImproved     = srResolved.filter((r) => r.pipOutcome === 'improved');

  const extendedHistory = await Confirmations.find({ 'history.status': 'extended' })
    .select('employeeName currentStatus history').lean();
  const confResolved = extendedHistory.filter((r) => r.currentStatus === 'confirmed' || r.currentStatus === 'not_confirmed');
  const confImproved = confResolved.filter((r) => r.currentStatus === 'confirmed');

  const totalResolved = srResolved.length + confResolved.length;
  const totalImproved = srImproved.length + confImproved.length;

  const performedAfterPipPct = totalResolved > 0
    ? Math.round((totalImproved / totalResolved) * 1000) / 10
    : null;

  // Quarterly trend — resolution date is pipOutcomeDate for SalaryRevision
  // PIPs (stamped by PUT /:id/pip-outcome), and the most recent history
  // entry's date for Confirmations (stamped whenever currentStatus last
  // changed — see the Confirmations model's history sub-schema).
  const confResolvedDate = (r) => {
    const dates = (r.history || []).map((h) => (h.date ? new Date(h.date) : null)).filter(Boolean);
    return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  };
  const resolvedWithDates = [
    ...srResolved.map((r) => ({ date: r.pipOutcomeDate ? new Date(r.pipOutcomeDate) : null, improved: r.pipOutcome === 'improved' })),
    ...confResolved.map((r) => ({ date: confResolvedDate(r), improved: r.currentStatus === 'confirmed' })),
  ].filter((r) => r.date);

  const quarters = [1, 2, 3, 4].map((q) => {
    const inQuarter = resolvedWithDates.filter((r) => fiscalYearOf(r.date) === year && fiscalQuarterOf(r.date) === q);
    const improved = inQuarter.filter((r) => r.improved).length;
    return {
      quarter: `Q${q}`,
      resolved: inQuarter.length,
      improved,
      improvedPct: inQuarter.length > 0 ? Math.round((improved / inQuarter.length) * 1000) / 10 : null,
    };
  });

  const resolvedYears = resolvedWithDates.map((r) => fiscalYearOf(r.date));
  const minYear = resolvedYears.length ? Math.min(...resolvedYears) : year;
  const maxYear = Math.max(fiscalYearOf(new Date()), ...(resolvedYears.length ? resolvedYears : [year]));
  const availableYears = [];
  for (let y = maxYear; y >= minYear; y--) availableYears.push(y);

  res.status(200).json({
    success: true,
    currentlyOnPip: currentlyOnPip.length,
    totalCurrentEmployees,
    pipPct,
    totalResolved,
    totalImproved,
    performedAfterPipPct,
    year,
    quarters,
    availableYears,
  });
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

router.put('/:id', asyncHandler(async (req, res) => {
  const {
    applicableDate,
    previousCtc,
    newCtc,
    finalIncrementPct,
    stage,
    designationChanged,
    previousDesignation,
    newDesignation,
    reportingHeadChanged,
    previousReportingHead,
    newReportingHead,
    managerDecision,
    managementDecision,
    hrDecision,
  } = req.body;

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }

  const setNumber = (value) => (value != null && value !== '' ? Number(value) : null);
  const safeDate = (value) => (value ? new Date(value) : null);

  if (previousCtc != null && previousCtc !== '') {
    revision.previousCtc = Number(previousCtc);
  }

  if (newCtc != null && newCtc !== '') {
    revision.newCtc = Number(newCtc);
  }

  if (finalIncrementPct != null && finalIncrementPct !== '') {
    revision.finalIncrementPct = Number(finalIncrementPct);
    revision.managementDecision = revision.managementDecision || {};
    revision.managementDecision.finalPct = Number(finalIncrementPct);

    if (revision.previousCtc != null) {
      revision.newCtc = Math.round(revision.previousCtc * (1 + Number(finalIncrementPct) / 100));
    }
  }

  if ((newCtc != null && newCtc !== '') && revision.previousCtc != null && revision.previousCtc !== 0) {
    revision.finalIncrementPct = Math.round(((revision.newCtc - revision.previousCtc) / revision.previousCtc) * 100 * 100) / 100;
    revision.managementDecision = revision.managementDecision || {};
    revision.managementDecision.finalPct = revision.finalIncrementPct;
  }

  if (applicableDate) {
    revision.applicableDate = new Date(applicableDate);
  }

  if (stage) revision.stage = stage;
  if (designationChanged != null) revision.designationChanged = Boolean(designationChanged);
  if (previousDesignation != null) revision.previousDesignation = previousDesignation;
  if (newDesignation != null) revision.newDesignation = newDesignation;
  if (reportingHeadChanged != null) revision.reportingHeadChanged = Boolean(reportingHeadChanged);
  if (previousReportingHead != null) revision.previousReportingHead = previousReportingHead;
  if (newReportingHead != null) revision.newReportingHead = newReportingHead;

  if (managerDecision && typeof managerDecision === 'object') {
    revision.managerDecision = {
      decision         : managerDecision.decision ?? revision.managerDecision.decision,
      recommendedPct   : setNumber(managerDecision.recommendedPct) ?? revision.managerDecision.recommendedPct,
      pipDurationMonths: setNumber(managerDecision.pipDurationMonths) ?? revision.managerDecision.pipDurationMonths,
      pipNewDueDate    : safeDate(managerDecision.pipNewDueDate) ?? revision.managerDecision.pipNewDueDate,
      reason           : managerDecision.reason ?? revision.managerDecision.reason,
      submittedAt      : managerDecision.submittedAt ? safeDate(managerDecision.submittedAt) : revision.managerDecision.submittedAt,
    };
  }

  if (managementDecision && typeof managementDecision === 'object') {
    revision.managementDecision = {
      finalPct   : setNumber(managementDecision.finalPct) ?? revision.managementDecision.finalPct,
      pipApproved: managementDecision.pipApproved != null ? Boolean(managementDecision.pipApproved) : revision.managementDecision.pipApproved,
      reason     : managementDecision.reason ?? revision.managementDecision.reason,
      submittedAt: managementDecision.submittedAt ? safeDate(managementDecision.submittedAt) : revision.managementDecision.submittedAt,
    };
  }

  if (hrDecision && typeof hrDecision === 'object') {
    revision.hrDecision = {
      newCtc             : setNumber(hrDecision.newCtc) ?? revision.hrDecision.newCtc,
      applicableDate     : safeDate(hrDecision.applicableDate) ?? revision.hrDecision.applicableDate,
      newContractStartDate: safeDate(hrDecision.newContractStartDate) ?? revision.hrDecision.newContractStartDate,
      newContractEndDate  : safeDate(hrDecision.newContractEndDate) ?? revision.hrDecision.newContractEndDate,
      notes              : hrDecision.notes ?? revision.hrDecision.notes,
      submittedAt        : hrDecision.submittedAt ? safeDate(hrDecision.submittedAt) : revision.hrDecision.submittedAt,
    };
  }

  revision.updatedBy = caller(req);
  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'Revision updated successfully' });
}));

// ─── POST /api/salary-revisions ──────────────────────────────────────────────
// Frontend payload now also supports (all optional):
// {
//   onboardingId, previousDesignation, newDesignation,
//   previousReportingHead, newReportingHead, previousCategory,
// }
// designationChanged / reportingHeadChanged / categoryChanged are derived,
// not sent directly. previousCategory is captured once, at creation time,
// from the employee's category AT THAT MOMENT — it is never overwritten
// afterward, even if the Manager step later changes category on this same
// revision. That's what makes it possible to tell "this revision recorded
// a category change" apart from "this revision was just created with
// whatever category the employee already had."

router.post('/', asyncHandler(async (req, res) => {
  const {
    onboardingId,
    employeeCode,
    employeeName,
    department,
    designation,
    email,
    joiningDate,
    contractStartDate,
    contractEndDate,
    category,
    applicableDate,
    previousCtc,
    pmsScores,
    previousDesignation,
    newDesignation,
    previousReportingHead,
    newReportingHead,
    previousCategory,
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
    contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
    contractEndDate  : contractEndDate ? new Date(contractEndDate) : null,
    category      : category || 'Employee',
    applicableDate: applicableDate ? new Date(applicableDate) : null,
    previousCtc   : Number(previousCtc),
    pmsScores     : Array.isArray(pmsScores) ? pmsScores.filter(p => p.period && p.period.trim()) : [],
    stage         : 'pending_manager',
    managerRequestedAt: new Date(),

    designationChanged,
    previousDesignation  : previousDesignation || designation || '',
    newDesignation        : designationChanged ? newDesignation : null,

    reportingHeadChanged,
    previousReportingHead : previousReportingHead || '',
    newReportingHead       : reportingHeadChanged ? newReportingHead : null,

    // Category has no "changed" signal yet at creation — it only becomes
    // true if the Manager step later submits a DIFFERENT category than
    // this. previousCategory is fixed here and never touched again.
    categoryChanged  : false,
    previousCategory : previousCategory || category || 'Employee',
    newCategory      : null,

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

    // Fire-and-forget — a mail failure must never fail the revision
    // creation itself, same convention as every other email trigger in
    // this codebase (e.g. rescoreAndSave's callers in hiringRequisitions.js).
    sendSalaryRevisionManagerRequest(revision).catch((e) =>
      console.error('[salary-revisions] manager request mail failed:', e.message));

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
// Manager can also propose a designation change, a reporting-head change,
// and/or a category change here, independently of whether they pick
// increment or PIP. Category change is tracked the exact same way
// designation/reporting-head already are: compare the submitted value
// against previousCategory (fixed at creation, never touched again), and
// only set categoryChanged/newCategory if it's genuinely different.

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

  if (Array.isArray(pmsScores)) {
    revision.pmsScores = pmsScores.filter(p => p.period && p.period.trim());
  }

  if (applicableDate !== undefined) revision.applicableDate = applicableDate ? new Date(applicableDate) : null;

  // Category change — tracked the same way as designation/reporting head:
  // compare against the FIXED previousCategory from creation time, not
  // whatever revision.category currently happens to hold.
  if (category) {
    const changed = category !== revision.previousCategory;
    revision.categoryChanged = changed;
    revision.newCategory = changed ? category : null;
    revision.category = category; // still the single "current" value everything else (e.g. Onboarding sync) reads
  }

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

  const decisionError = applyManagerDecision(revision, { decision, reason, recommendedPct, pipDurationMonths, pipNewDueDate });
  if (decisionError) return res.status(400).json({ success: false, message: decisionError });

  revision.updatedBy = caller(req);
  await revision.save();

  sendSalaryRevisionManagementApproval(revision).catch((e) =>
    console.error('[salary-revisions] management approval mail failed:', e.message));

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

  const decisionError = applyManagementDecision(revision, { reason, finalPct, pipApproved });
  if (decisionError) return res.status(400).json({ success: false, message: decisionError });

  revision.updatedBy = caller(req);
  await revision.save();

  if (revision.stage === 'on_hold') {
    sendSalaryRevisionPipHold(revision).catch((e) =>
      console.error('[salary-revisions] PIP hold mail failed:', e.message));
  } else if (revision.stage === 'pending_manager') {
    // PIP rejected — reopened back to the manager for a fresh recommendation.
    sendSalaryRevisionManagerRequest(revision).catch((e) =>
      console.error('[salary-revisions] manager re-request mail failed:', e.message));
  }

  res.status(200).json({ success: true, data: revision, message: 'Management decision saved' });
}));

// ─── GET /api/salary-revisions/:id/mail-action ───────────────────────────────
// Public, unauthenticated — feeds the manager/management mail-action form
// (frontend/src/pages/outsider/SalaryRevisionAction.tsx) with exactly what
// it needs to render, and whether the link is still actionable. The
// revision may have already moved past this role's stage since the mail
// was sent (e.g. someone already actioned it from the dashboard, or this
// link was already used once) — "actionable" tells the form to show a
// "already handled" message instead of letting a stale link resubmit.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/mail-action', asyncHandler(async (req, res) => {
  const { role, sig } = req.query;
  if (!['manager', 'management'].includes(role) || !verifySalaryRevisionAction(req.params.id, role, sig)) {
    return res.status(403).json({ success: false, message: "This link couldn't be verified." });
  }

  const revision = await SalaryRevision.findById(req.params.id).lean();
  if (!revision) return res.status(404).json({ success: false, message: 'Salary revision not found' });

  const expectedStage = role === 'manager' ? 'pending_manager' : 'pending_management';
  const manager = await resolveManagerContact(revision);

  res.json({
    success: true,
    data: {
      employeeName : revision.employeeName,
      department   : revision.department,
      designation  : revision.designation,
      previousCtc  : revision.previousCtc,
      managerName  : manager.name,
      stage        : revision.stage,
      actionable   : revision.stage === expectedStage,
      // Management needs to see what the manager actually recommended.
      managerDecision: role === 'management' ? revision.managerDecision : undefined,
    },
  });
}));

// ─── POST /api/salary-revisions/:id/mail-action ──────────────────────────────
// Public, unauthenticated submit — applies the EXACT same
// applyManagerDecision/applyManagementDecision used by the authenticated
// dashboard routes above, and triggers the same follow-up mail, so a
// decision filled in from the email shows up on the dashboard identically
// to one entered there directly.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/mail-action', asyncHandler(async (req, res) => {
  const { role, sig, ...body } = req.body;
  if (!['manager', 'management'].includes(role) || !verifySalaryRevisionAction(req.params.id, role, sig)) {
    return res.status(403).json({ success: false, message: "This link couldn't be verified." });
  }

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) return res.status(404).json({ success: false, message: 'Salary revision not found' });

  if (role === 'manager') {
    if (revision.stage !== 'pending_manager') {
      return res.status(400).json({ success: false, message: `This request has already been actioned (current stage: ${revision.stage}).` });
    }
    const decisionError = applyManagerDecision(revision, body);
    if (decisionError) return res.status(400).json({ success: false, message: decisionError });

    revision.updatedBy = 'Manager (via email)';
    await revision.save();

    sendSalaryRevisionManagementApproval(revision).catch((e) =>
      console.error('[salary-revisions] management approval mail failed:', e.message));

    return res.json({ success: true, message: 'Manager decision saved' });
  }

  // role === 'management'
  if (revision.stage !== 'pending_management') {
    return res.status(400).json({ success: false, message: `This request has already been actioned (current stage: ${revision.stage}).` });
  }
  const decisionError = applyManagementDecision(revision, body);
  if (decisionError) return res.status(400).json({ success: false, message: decisionError });

  revision.updatedBy = 'Management (via email)';
  await revision.save();

  if (revision.stage === 'on_hold') {
    sendSalaryRevisionPipHold(revision).catch((e) =>
      console.error('[salary-revisions] PIP hold mail failed:', e.message));
  } else if (revision.stage === 'pending_manager') {
    sendSalaryRevisionManagerRequest(revision).catch((e) =>
      console.error('[salary-revisions] manager re-request mail failed:', e.message));
  }

  res.json({ success: true, message: 'Management decision saved' });
}));

// ─── PUT /api/salary-revisions/:id/pip-outcome ───────────────────────────────
// Closes out an active PIP. Nothing else in this model ever moves an
// approved PIP off 'on_hold' — without this route it just sat open forever
// with no record of whether the employee actually improved.

router.put('/:id/pip-outcome', asyncHandler(async (req, res) => {
  const { outcome, reason } = req.body;

  if (!['improved', 'not_improved'].includes(outcome)) {
    return res.status(400).json({ success: false, message: "outcome must be 'improved' or 'not_improved'" });
  }

  const revision = await SalaryRevision.findById(req.params.id);
  if (!revision) {
    return res.status(404).json({ success: false, message: 'Salary revision not found' });
  }

  if (revision.stage !== 'on_hold') {
    return res.status(400).json({
      success: false,
      message: `Cannot close out PIP — current stage is '${revision.stage}', not 'on_hold'`,
    });
  }

  revision.pipOutcome       = outcome;
  revision.pipOutcomeReason = (reason || '').trim();
  revision.pipOutcomeDate   = new Date();
  revision.stage            = 'completed';
  revision.updatedBy        = caller(req);

  await revision.save();

  res.status(200).json({ success: true, data: revision, message: 'PIP outcome recorded' });
}));

// ─── PUT /api/salary-revisions/:id/hr ────────────────────────────────────────
// Finalises the revision AND syncs the latest values back onto the
// Onboarding record — designation only if it actually changed, reporting
// head only if it changed, salary numbers and category always (even a
// "0% increment, no category change" finalization still confirms the
// current CTC/category as the latest figures — same reasoning as the
// designation/reporting-head "changed" flags, just applied to fields that
// don't have their own explicit changed flag for THIS purpose — category
// now has categoryChanged too, but Onboarding still gets the current
// value unconditionally, same as CTC/applicable date).
router.put('/:id/hr', asyncHandler(async (req, res) => {
  const { notes, applicableDate, newCtc, newContractStartDate, newContractEndDate, fullTimeSince } = req.body;

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
  const newCStart = newContractStartDate ? new Date(newContractStartDate) : null;
  const newCEnd   = newContractEndDate ? new Date(newContractEndDate) : null;
  const fullTime  = fullTimeSince ? new Date(fullTimeSince) : null;

  revision.hrDecision = {
    newCtc        : finalCtc,
    applicableDate: appDate,
    newContractStartDate: newCStart,
    newContractEndDate  : newCEnd,
    fullTimeSince : fullTime,
    notes         : (notes || '').trim(),
    submittedAt   : new Date(),
  };

  revision.newCtc           = finalCtc;
  revision.applicableDate   = appDate;
  revision.newContractStartDate = newCStart;
  revision.newContractEndDate   = newCEnd;
  revision.fullTimeSince    = fullTime;
  revision.finalIncrementPct = revision.managementDecision?.finalPct ?? revision.finalIncrementPct ?? 0;
  revision.stage            = 'completed';
  revision.updatedBy        = caller(req);

  await revision.save();

  // ─── Sync latest values back onto the Onboarding record ────────────────
  // Onboarding is the dashboard's source of truth — it should always show
  // the CURRENT designation/salary/category, while this revision stays in
  // history.
  try {
    const onboardingUpdate = {
      annualCtc: finalCtc,
      salApplicableFrom: appDate,
      salReviewStatus: 'Revised',
      employeeCategory: revision.category,
    };
    if (revision.designationChanged && revision.newDesignation) {
      onboardingUpdate.designation = revision.newDesignation;
    }
    if (revision.reportingHeadChanged && revision.newReportingHead) {
      onboardingUpdate.reportingHead = revision.newReportingHead;
    }
    if (newCStart) onboardingUpdate.contractStartDate = newCStart;
    if (newCEnd)   onboardingUpdate.contractEndDate   = newCEnd;

    // Only ever target by onboardingId — a real Mongo ObjectId set at
    // creation time. Previously this fell back to revision.employeeCode,
    // which is NOT guaranteed to be a valid ObjectId — that fallback
    // could silently target nothing and fail the whole sync without any
    // visible error, exactly the failure mode worth avoiding here.
    if (revision.onboardingId) {
      await Onboarding.findByIdAndUpdate(revision.onboardingId, { $set: onboardingUpdate });
    } else {
      console.error(
        `Onboarding sync-back skipped for revision ${revision._id} — no onboardingId on record. ` +
        `employeeCode=${revision.employeeCode}, employeeName=${revision.employeeName}`
      );
    }
  } catch (syncErr) {
    // Don't fail the whole request if the sync-back has an issue — the
    // revision itself is already saved and correct; log for follow-up.
    console.error('Onboarding sync-back failed:', syncErr.message);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // This route is only reachable from 'pending_hr', which the management
  // route only sets on the increment path (PIP goes management -> on_hold
  // -> pip-outcome -> completed, never through here) — so every successful
  // finalisation here is an increment being confirmed to the employee.
  sendSalaryRevisionEmployeeConfirmation(revision).catch((e) =>
    console.error('[salary-revisions] employee confirmation mail failed:', e.message));

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