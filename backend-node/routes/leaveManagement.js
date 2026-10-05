const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');

const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../config/roles');
const Onboarding = require('../models/onboardingModel');
const LeaveType = require('../models/LeaveType');
const LeaveAllocation = require('../models/LeaveAllocation');
const LeaveRequest = require('../models/LeaveRequest');
const { computeLeaveDuration } = require('../utils/leaveDuration');
const { computeLeaveBalance } = require('../utils/leaveBalance');
const { uploadFileToDrive } = require('../utils/googleDrive');
const { resolveManagerEmailByName } = require('../utils/resolveManagerContact');
const sendEmail = require('../emails/sendEmail');
const signature = require('../utils/signature');

const HR_ROLES = ['Admin', 'HR'];
// Allowed to file a request on someone else's behalf (employeeId in the
// body) — an ordinary Employee can only ever file for themselves.
const FILE_ON_BEHALF_ROLES = ['Admin', 'HR', 'Manager'];
const PENDING_STATUSES = ['to_approve', 'second_approval'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Login email is reliable; req.user's display name is not (documented
// precedent: resolveManagerContact.js / salaryRevisions.js resolveOwnFullName)
// — always resolve the caller's own Onboarding record via email.
async function resolveOwnOnboarding(req) {
  const email = (req.user?.email || '').toLowerCase();
  if (!email) return null;
  return Onboarding.findOne({ $or: [{ officialEmail: email }, { persEmail: email }] })
    .select('name dept designation empId officialEmail persEmail reportingHead exitStatus')
    .lean();
}

async function resolveSubjectOnboarding(req) {
  const canFileOnBehalf = FILE_ON_BEHALF_ROLES.includes(req.role);
  if (canFileOnBehalf && req.body?.employeeId) {
    return Onboarding.findById(req.body.employeeId)
      .select('name dept designation empId officialEmail persEmail reportingHead exitStatus')
      .lean();
  }
  return resolveOwnOnboarding(req);
}

function snapshotFromOnboarding(doc) {
  return {
    employeeId: doc._id,
    employeeCode: doc.empId || '',
    employeeName: doc.name || '',
    department: doc.dept || '',
    designation: doc.designation || '',
    employeeEmail: doc.officialEmail || doc.persEmail || '',
    reportingHead: doc.reportingHead || '',
  };
}

function addAudit(request, action, by, note = '') {
  request.auditLog.push({
    action,
    by,
    at: new Date(),
    fromStatus: request._fromStatus ?? request.status,
    toStatus: request.status,
    note,
  });
}

function escapeRegex(s) {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive, whitespace-collapsed name compare — reportingHead is a
// plain name string (see onboardingModel.js), not a reference, so this is
// the only way to match "is this logged-in user this request's manager".
function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Shared overlap + balance check — used both when a request first leaves
// 'draft' (validateForSubmit) and again right before it's finally approved
// (validateFinalApproval), since another request may have consumed the
// balance or created an overlap in the meantime.
async function validateOverlapAndBalance({ employeeId, leaveType, dateFrom, dateTo, durationDays, excludeRequestId }) {
  const overlap = await LeaveRequest.findOne({
    employeeId,
    status: { $in: [...PENDING_STATUSES, 'approved'] },
    ...(excludeRequestId ? { _id: { $ne: excludeRequestId } } : {}),
    dateFrom: { $lte: dateTo },
    dateTo: { $gte: dateFrom },
  }).lean();
  if (overlap) {
    return 'This overlaps with an existing pending or approved leave request.';
  }

  if (leaveType.requiresAllocation && !leaveType.allowNegativeBalance) {
    const balance = await computeLeaveBalance(employeeId, { excludeRequestId });
    const row = balance.find((b) => b.leaveTypeId === String(leaveType._id));
    const available = row ? row.available : 0;
    if (durationDays > available) {
      return `Insufficient balance — ${available} day(s) available for ${leaveType.name}.`;
    }
  }

  return null;
}

// Validates dates/overlap/balance/maxDaysPerRequest/document for a request
// that's about to leave 'draft' (i.e. actually be submitted for approval).
// Returns an error message string, or null if everything checks out.
async function validateForSubmit({ employeeId, leaveType, dateFrom, dateTo, durationDays, document, excludeRequestId }) {
  if (leaveType.maxDaysPerRequest != null && durationDays > leaveType.maxDaysPerRequest) {
    return `This leave type allows at most ${leaveType.maxDaysPerRequest} day(s) per request.`;
  }
  if (leaveType.requiresDocument && !document?.driveLink) {
    return 'This leave type requires a supporting document before it can be submitted.';
  }
  return validateOverlapAndBalance({ employeeId, leaveType, dateFrom, dateTo, durationDays, excludeRequestId });
}

// Re-checked right before a request becomes 'approved' — someone else's
// request may have eaten the balance, or created an overlap, since this one
// was originally submitted.
async function validateFinalApproval(request, leaveType) {
  return validateOverlapAndBalance({
    employeeId: request.employeeId,
    leaveType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    durationDays: request.durationDays,
    excludeRequestId: request._id,
  });
}

// ─── Who's turn is it ───────────────────────────────────────────────────────────
// NOTE: reportingHead on Onboarding is a plain name string with no id-based
// alternative anywhere in the schema (checked) — name matching is what we
// have. Fragile against duplicate names or a renamed employee whose old
// records still carry the old spelling; flagged to the user as a known gap.

async function resolveCallerContext(req) {
  const own = await resolveOwnOnboarding(req);
  return {
    ownId: own?._id ? String(own._id) : null,
    ownName: normalizeName(own?.name || req.user?.name),
    displayName: own?.name || req.user?.name || req.user?.email || '',
    isHr: HR_ROLES.includes(req.role),
  };
}

// Shared by getAllowedActions and canSendMail (Phase 4) — who, relative to
// this specific request, the caller is.
function callerRelation(request, caller) {
  const isOwner = !!caller.ownId && String(request.employeeId) === caller.ownId;
  const isReportingManager = !isOwner && !!caller.ownName && normalizeName(request.reportingHead) === caller.ownName;
  return { isOwner, isReportingManager };
}

// Single source of truth for what a given caller may do with a given
// request — used both to guard the approve/refuse/cancel routes AND
// surfaced on every GET response so the frontend never has to re-derive it.
function getAllowedActions(request, leaveType, caller) {
  const { isOwner, isReportingManager } = callerRelation(request, caller);

  // An employee can never approve/refuse their own request, even if they
  // also happen to hold an HR/Manager role.
  let canActOnApproval = false;
  if (!isOwner && leaveType && leaveType.approvalMode !== 'none') {
    if (request.status === 'to_approve') {
      canActOnApproval = leaveType.approvalMode === 'hr' ? caller.isHr : (caller.isHr || isReportingManager);
    } else if (request.status === 'second_approval') {
      canActOnApproval = caller.isHr;
    }
  }

  let canCancel = false;
  if (!['refused', 'cancelled'].includes(request.status)) {
    if (request.status === 'approved') {
      const isPast = new Date(request.dateFrom) < new Date();
      canCancel = !isPast && caller.isHr;
    } else {
      canCancel = isOwner || caller.isHr;
    }
  }

  return { canApprove: canActOnApproval, canRefuse: canActOnApproval, canCancel };
}

async function enrichWithPermissions(doc, req) {
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const [leaveType, caller] = await Promise.all([
    LeaveType.findById(plain.leaveTypeId).lean(),
    resolveCallerContext(req),
  ]);
  return { ...plain, allowedActions: getAllowedActions(plain, leaveType, caller), mailAction: getMailAction(plain, caller) };
}

async function enrichListWithPermissions(docs, req) {
  if (!docs.length) return [];
  const caller = await resolveCallerContext(req);
  const typeIds = [...new Set(docs.map((d) => String(d.leaveTypeId)))];
  const types = await LeaveType.find({ _id: { $in: typeIds } }).lean();
  const typeById = new Map(types.map((t) => [String(t._id), t]));
  return docs.map((d) => ({
    ...d,
    allowedActions: getAllowedActions(d, typeById.get(String(d.leaveTypeId)), caller),
    mailAction: getMailAction(d, caller),
  }));
}

// ─── Mail (Phase 4) ─────────────────────────────────────────────────────────────
// No drafts collection — HTML/subject/recipients are built on demand from
// live request data and never persisted until the mail actually sends; the
// only stored state is request.mails[type] (set once, never resent).

const MAIL_TYPES = ['submitted', 'managerApproved', 'approved', 'refused', 'cancelled'];

// Which mail type(s) are relevant for the request's CURRENT status — also
// doubles as the "does this status even reach this mail" gate (e.g.
// 'managerApproved' only ever applies at second_approval, which itself only
// ever happens for a manager_then_hr type, so no extra approvalMode check
// is needed here).
const MAIL_TYPE_FOR_STATUS = {
  to_approve: ['submitted'],
  second_approval: ['managerApproved'],
  approved: ['approved'],
  refused: ['refused'],
  cancelled: ['cancelled'],
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitEmails(value) {
  return (value || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

// "The person whose action triggered it, or HR/Admin" — same
// isOwner/isReportingManager relation Phase 2's getAllowedActions uses,
// just mapped to who caused each mail-worthy event rather than who can
// approve/refuse/cancel right now (status may have already moved on by the
// time someone opens the composer).
function canSendMail(mailType, request, caller) {
  if (caller.isHr) return true;
  const { isOwner, isReportingManager } = callerRelation(request, caller);
  switch (mailType) {
    case 'submitted': return isOwner;
    case 'managerApproved': return isReportingManager;
    case 'approved': return isReportingManager;
    case 'refused': return isReportingManager;
    case 'cancelled': return isOwner;
    default: return false;
  }
}

// Which single mail type (if any) is both applicable-to-current-status and
// still unsent, plus whether THIS caller is allowed to send it — drives the
// one "Send mail" button in the detail dialog.
function getMailAction(request, caller) {
  const candidates = MAIL_TYPE_FOR_STATUS[request.status] || [];
  const pending = candidates.find((mt) => !request.mails?.[mt]?.sentAt);
  if (!pending) return null;
  return { type: pending, canSend: canSendMail(pending, request, caller) };
}

function fmtDateShort(d) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
}

async function resolveMailRecipients(mailType, request, leaveType) {
  const hrEmail = (process.env.HR_HEAD_EMAIL || '').trim();
  const managerEmail = async () => {
    const { email } = await resolveManagerEmailByName(request.reportingHead, request.department);
    return (email || '').trim();
  };

  let to = '';
  let cc = '';

  if (mailType === 'submitted') {
    to = leaveType.approvalMode === 'hr' ? hrEmail : await managerEmail();
  } else if (mailType === 'managerApproved') {
    to = hrEmail;
  } else if (mailType === 'approved' || mailType === 'refused') {
    to = request.employeeEmail || '';
    cc = await managerEmail();
  } else if (mailType === 'cancelled') {
    to = await managerEmail();
    const cancelEntry = [...(request.auditLog || [])].reverse().find((a) => a.action === 'cancelled');
    if (cancelEntry?.fromStatus === 'approved') cc = hrEmail;
  }

  const warning = to ? null : 'Could not resolve a recipient email automatically — fill in the To field before sending.';
  return { to, cc, warning };
}

function leaveMailSubject(mailType, request, leaveType) {
  const dateStr = `${fmtDateShort(request.dateFrom)} – ${fmtDateShort(request.dateTo)}`;
  switch (mailType) {
    case 'submitted': return `Leave Request Needs Approval — ${request.employeeName} (${leaveType.name}, ${dateStr})`;
    case 'managerApproved': return `Leave Approved by Manager — ${request.employeeName} (${leaveType.name}, ${dateStr})`;
    case 'approved': return `Your Leave Request is Approved — ${leaveType.name}, ${dateStr}`;
    case 'refused': return `Your Leave Request was Refused — ${leaveType.name}, ${dateStr}`;
    case 'cancelled': return `Leave Request Cancelled — ${request.employeeName} (${leaveType.name}, ${dateStr})`;
    default: return 'Leave Request Update';
  }
}

function leaveMailHtml(mailType, request, leaveType) {
  const dateStr = `${fmtDateShort(request.dateFrom)} – ${fmtDateShort(request.dateTo)}`;
  const details = `
    <p>Employee: <b>${request.employeeName}</b>
      <br>Leave Type: <b>${leaveType.name}</b>
      <br>Dates: <b>${dateStr}</b>
      <br>Duration: <b>${request.durationDays} day(s)</b>
      ${request.reason ? `<br>Reason: <b>${request.reason}</b>` : ''}
    </p>`;

  let intro;
  switch (mailType) {
    case 'submitted':
      intro = `<p>Dear ${leaveType.approvalMode === 'hr' ? 'HR' : 'Manager'},</p><p>A new leave request needs your approval.</p>`;
      break;
    case 'managerApproved':
      intro = `<p>Dear HR,</p><p>The reporting manager has approved this leave request — it now needs your final approval.</p>
        ${request.managerDecision?.comment ? `<p>Manager's note: <i>${request.managerDecision.comment}</i></p>` : ''}`;
      break;
    case 'approved':
      intro = `<p>Dear ${request.employeeName},</p><p>Your leave request has been <b style="color:#16a34a">approved</b>.</p>`;
      break;
    case 'refused':
      intro = `<p>Dear ${request.employeeName},</p><p>Your leave request has been <b style="color:#dc2626">refused</b>.</p>
        ${request.refusalReason ? `<p>Reason: <b>${request.refusalReason}</b></p>` : ''}`;
      break;
    case 'cancelled':
      intro = `<p>Dear Manager,</p><p>This leave request has been <b>cancelled</b>.</p>`;
      break;
    default:
      intro = '';
  }

  return `${intro}${details}${signature()}`;
}

// ─── Leave Types ──────────────────────────────────────────────────────────────
// Full CRUD lives here now (small and needed to seed types for balance/My
// Time Off to mean anything); the dedicated inline-panel HR Config UI for
// this is Phase 3 — these endpoints are what it will call.

router.get('/types', authenticate, asyncHandler(async (req, res) => {
  const activeOnly = req.query.all !== 'true';
  const filter = activeOnly ? { isActive: true } : {};
  const types = await LeaveType.find(filter).sort({ name: 1 }).lean();
  res.json({ success: true, data: types });
}));

router.post('/types', authenticate, requireRole(HR_ROLES), asyncHandler(async (req, res) => {
  const doc = await LeaveType.create(req.body);
  res.status(201).json({ success: true, data: doc });
}));

router.put('/types/:id', authenticate, requireRole(HR_ROLES), asyncHandler(async (req, res) => {
  const doc = await LeaveType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ success: false, message: 'Leave type not found' });
  res.json({ success: true, data: doc });
}));

router.delete('/types/:id', authenticate, requireRole(HR_ROLES), asyncHandler(async (req, res) => {
  // Soft-delete — a type with history attached (allocations/requests) must
  // stay resolvable for those old records, so this just hides it from new use.
  const doc = await LeaveType.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) return res.status(404).json({ success: false, message: 'Leave type not found' });
  res.json({ success: true, data: doc });
}));

// ─── Allocations ──────────────────────────────────────────────────────────────
// Minimal CRUD for now — the bulk-assign/accrual-toggle HR Config UI is
// Phase 3; these are the endpoints it will drive.

router.get('/allocations', authenticate, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  const docs = await LeaveAllocation.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: docs });
}));

router.post('/allocations', authenticate, requireRole(HR_ROLES), asyncHandler(async (req, res) => {
  const employee = await Onboarding.findById(req.body.employeeId)
    .select('name empId dept').lean();
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const doc = await LeaveAllocation.create({
    ...req.body,
    employeeCode: employee.empId || '',
    employeeName: employee.name || '',
    department: employee.dept || '',
    createdBy: req.user?.name || req.user?.email || '',
  });
  res.status(201).json({ success: true, data: doc });
}));

router.put('/allocations/:id', authenticate, requireRole(HR_ROLES), asyncHandler(async (req, res) => {
  const doc = await LeaveAllocation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ success: false, message: 'Allocation not found' });
  res.json({ success: true, data: doc });
}));

// Live duration preview for the New Time Off form — only the backend knows
// the working-day schedule and public holidays, so the modal calls this on
// every date/half-day change instead of guessing client-side.
router.get('/duration-preview', authenticate, asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, halfDay } = req.query;
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ success: false, message: 'dateFrom and dateTo are required' });
  }
  try {
    const durationDays = await computeLeaveDuration(
      new Date(dateFrom), new Date(dateTo), { enabled: halfDay === 'true' }
    );
    res.json({ success: true, data: { durationDays } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}));

// ─── Balance ──────────────────────────────────────────────────────────────────

router.get('/balance/:employeeId', authenticate, asyncHandler(async (req, res) => {
  const data = await computeLeaveBalance(req.params.employeeId);
  res.json({ success: true, data });
}));

// Convenience alias for "my own balance" — resolves the caller's own
// Onboarding record instead of requiring the frontend to already know its id.
router.get('/balance', authenticate, asyncHandler(async (req, res) => {
  const own = await resolveOwnOnboarding(req);
  if (!own) return res.status(404).json({ success: false, message: 'No onboarding record found for your login email' });
  const data = await computeLeaveBalance(own._id);
  res.json({ success: true, data });
}));

// ─── Requests ─────────────────────────────────────────────────────────────────

router.get('/requests', authenticate, asyncHandler(async (req, res) => {
  const { scope = 'mine', status, from, to, department, source } = req.query;
  const filter = {};

  if (scope === 'all' && !HR_ROLES.includes(req.role)) {
    return res.status(403).json({ success: false, message: 'Only HR/Admin can view all requests' });
  }

  if (scope === 'mine') {
    const own = await resolveOwnOnboarding(req);
    if (!own) return res.json({ success: true, data: [] });
    filter.employeeId = own._id;
  }
  // 'team', 'all', and 'pending_my_action' can't be expressed as a single
  // Mongo filter (team/pending_my_action depend on the name-matched
  // reportingHead + per-row approval-mode logic) — fetched broadly below
  // and narrowed in JS via the same getAllowedActions() every other
  // permission check uses, so the rules can't drift between list and action.

  if (status) filter.status = status;
  if (department) filter.department = department;
  if (source) filter.source = source;
  if (from || to) {
    filter.dateFrom = {};
    if (from) filter.dateFrom.$gte = new Date(from);
    if (to) filter.dateFrom.$lte = new Date(to);
  }

  let docs = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean();

  if (scope === 'team' || scope === 'pending_my_action') {
    const caller = await resolveCallerContext(req);
    if (!caller.isHr) {
      docs = docs.filter((d) => normalizeName(d.reportingHead) === caller.ownName);
    }
    if (scope === 'pending_my_action') {
      const enriched = await enrichListWithPermissions(docs, req);
      return res.json({
        success: true,
        data: enriched.filter((d) => ['to_approve', 'second_approval'].includes(d.status) && d.allowedActions.canApprove),
      });
    }
  }

  res.json({ success: true, data: await enrichListWithPermissions(docs, req) });
}));

router.get('/requests/:id', authenticate, asyncHandler(async (req, res) => {
  const doc = await LeaveRequest.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Leave request not found' });
  res.json({ success: true, data: await enrichWithPermissions(doc, req) });
}));

// Creates a request. `submit: true` in the body moves it straight to
// to_approve/approved (per the leave type's approvalMode); omitted/false
// just saves a draft with no validation beyond the basic required fields.
router.post('/requests', authenticate, asyncHandler(async (req, res) => {
  const { leaveTypeId, dateFrom, dateTo, halfDay, reason, document, submit } = req.body;

  if (!leaveTypeId || !dateFrom || !dateTo) {
    return res.status(400).json({ success: false, message: 'Leave type and dates are required' });
  }

  const [subject, leaveType] = await Promise.all([
    resolveSubjectOnboarding(req),
    LeaveType.findById(leaveTypeId).lean(),
  ]);
  if (!subject) return res.status(404).json({ success: false, message: 'No onboarding record found for this employee' });
  if (!leaveType || !leaveType.isActive) return res.status(404).json({ success: false, message: 'Leave type not found' });

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return res.status(400).json({ success: false, message: 'Invalid date range' });
  }
  if (halfDay?.enabled && from.toDateString() !== to.toDateString()) {
    return res.status(400).json({ success: false, message: 'A half-day request must be a single day' });
  }

  let durationDays;
  try {
    durationDays = await computeLeaveDuration(from, to, halfDay);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (durationDays <= 0) {
    return res.status(400).json({ success: false, message: 'This date range has no working days in it' });
  }

  const wantsSubmit = submit === true;
  if (wantsSubmit) {
    const err = await validateForSubmit({
      employeeId: subject._id, leaveType, dateFrom: from, dateTo: to, durationDays, document,
    });
    if (err) return res.status(400).json({ success: false, message: err });
  }

  const initialStatus = !wantsSubmit ? 'draft' : (leaveType.approvalMode === 'none' ? 'approved' : 'to_approve');

  const request = new LeaveRequest({
    ...snapshotFromOnboarding(subject),
    leaveTypeId,
    dateFrom: from,
    dateTo: to,
    halfDay: halfDay?.enabled ? { enabled: true, session: halfDay.session || 'first_half' } : { enabled: false, session: null },
    durationDays,
    reason: (reason || '').trim(),
    document: document?.driveLink ? document : undefined,
    status: initialStatus,
    createdBy: req.user?.name || req.user?.email || '',
  });

  const by = req.user?.name || req.user?.email || '';
  request._fromStatus = 'draft';
  addAudit(request, wantsSubmit ? 'submitted' : 'draft_created', by);

  const saved = await request.save();
  res.status(201).json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

// Edits a draft in place — recomputes duration, does NOT run submit
// validation (that happens on the separate /submit call).
router.put('/requests/:id', authenticate, asyncHandler(async (req, res) => {
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (request.status !== 'draft') {
    return res.status(400).json({ success: false, message: 'Only a draft request can be edited' });
  }

  const { leaveTypeId, dateFrom, dateTo, halfDay, reason, document } = req.body;
  const leaveType = leaveTypeId
    ? await LeaveType.findById(leaveTypeId).lean()
    : await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  const from = dateFrom ? new Date(dateFrom) : request.dateFrom;
  const to = dateTo ? new Date(dateTo) : request.dateTo;
  if (to < from) return res.status(400).json({ success: false, message: 'Invalid date range' });

  const effectiveHalfDay = halfDay ?? request.halfDay;
  let durationDays;
  try {
    durationDays = await computeLeaveDuration(from, to, effectiveHalfDay);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (leaveTypeId) request.leaveTypeId = leaveTypeId;
  request.dateFrom = from;
  request.dateTo = to;
  request.halfDay = effectiveHalfDay?.enabled ? { enabled: true, session: effectiveHalfDay.session || 'first_half' } : { enabled: false, session: null };
  request.durationDays = durationDays;
  if (reason !== undefined) request.reason = reason.trim();
  if (document?.driveLink) request.document = document;

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

router.put('/requests/:id/submit', authenticate, asyncHandler(async (req, res) => {
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (request.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Cannot submit — current status is '${request.status}'` });
  }

  const leaveType = await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  const err = await validateForSubmit({
    employeeId: request.employeeId,
    leaveType,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    durationDays: request.durationDays,
    document: request.document,
    excludeRequestId: request._id,
  });
  if (err) return res.status(400).json({ success: false, message: err });

  request._fromStatus = request.status;
  request.status = leaveType.approvalMode === 'none' ? 'approved' : 'to_approve';
  addAudit(request, 'submitted', req.user?.name || req.user?.email || '');

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

// Cancel. Rules (Phase 2): draft/to_approve/second_approval — the owning
// employee or HR/Admin; approved — blocked once dateFrom has passed,
// otherwise HR/Admin only (there's no "employee requests cancellation of an
// approved leave" flow in this codebase, so that case is HR/Admin-only
// rather than self-service — flagged to the user as an assumption).
router.put('/requests/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

  if (['refused', 'cancelled'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `This request is already ${request.status}` });
  }

  const caller = await resolveCallerContext(req);
  const isOwner = !!caller.ownId && String(request.employeeId) === caller.ownId;

  if (request.status === 'approved') {
    if (new Date(request.dateFrom) < new Date()) {
      return res.status(400).json({ success: false, message: 'Cannot cancel an approved leave that has already started' });
    }
    if (!caller.isHr) {
      return res.status(403).json({ success: false, message: 'An approved leave can only be cancelled by HR/Admin' });
    }
  } else if (!isOwner && !caller.isHr) {
    return res.status(403).json({ success: false, message: 'You are not authorized to cancel this request' });
  }

  request._fromStatus = request.status;
  request.status = 'cancelled';
  addAudit(request, 'cancelled', caller.displayName, req.body?.note || '');

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

// Approve. 'manager' mode: the reporting manager (or HR/Admin) approves
// directly. 'hr' mode: HR/Admin only. 'manager_then_hr': the manager's
// approval (or HR/Admin acting at that stage) advances to second_approval;
// HR/Admin then gives the final approval. An HR/Admin approving at the
// to_approve stage of a manager_then_hr request is treated as a full
// override — it records both decisions and finalizes immediately, rather
// than forcing a second click HR would just make themselves.
router.put('/requests/:id/approve', authenticate, asyncHandler(async (req, res) => {
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (!['to_approve', 'second_approval'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `Cannot approve — current status is '${request.status}'` });
  }

  const leaveType = await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  const caller = await resolveCallerContext(req);
  const isOwner = !!caller.ownId && String(request.employeeId) === caller.ownId;
  if (isOwner) return res.status(403).json({ success: false, message: 'You cannot approve your own request' });

  const allowed = getAllowedActions(request, leaveType, caller);
  if (!allowed.canApprove) {
    return res.status(403).json({ success: false, message: 'You are not authorized to approve this request at its current stage' });
  }

  const by = caller.displayName;
  const comment = (req.body?.comment || '').trim();
  const fromStatus = request.status;
  let nextStatus;

  if (request.status === 'to_approve') {
    request.managerDecision = { by, at: new Date(), comment };
    if (leaveType.approvalMode === 'manager_then_hr' && !caller.isHr) {
      nextStatus = 'second_approval';
    } else {
      nextStatus = 'approved';
      if (leaveType.approvalMode === 'manager_then_hr') {
        request.hrDecision = { by, at: new Date(), comment };
      }
    }
  } else {
    request.hrDecision = { by, at: new Date(), comment };
    nextStatus = 'approved';
  }

  if (nextStatus === 'approved') {
    const err = await validateFinalApproval(request, leaveType);
    if (err) return res.status(400).json({ success: false, message: err });
  }

  request.status = nextStatus;
  request._fromStatus = fromStatus;
  addAudit(request, 'approved', by, comment);

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

router.put('/requests/:id/refuse', authenticate, asyncHandler(async (req, res) => {
  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, message: 'A reason is required to refuse this request' });

  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (!['to_approve', 'second_approval'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `Cannot refuse — current status is '${request.status}'` });
  }

  const leaveType = await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  const caller = await resolveCallerContext(req);
  const isOwner = !!caller.ownId && String(request.employeeId) === caller.ownId;
  if (isOwner) return res.status(403).json({ success: false, message: 'You cannot refuse your own request' });

  const allowed = getAllowedActions(request, leaveType, caller);
  if (!allowed.canRefuse) {
    return res.status(403).json({ success: false, message: 'You are not authorized to refuse this request at its current stage' });
  }

  const by = caller.displayName;
  const fromStatus = request.status;
  if (request.status === 'to_approve') request.managerDecision = { by, at: new Date(), comment: reason };
  else request.hrDecision = { by, at: new Date(), comment: reason };

  request.refusalReason = reason;
  request.status = 'refused';
  request._fromStatus = fromStatus;
  addAudit(request, 'refused', by, reason);

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

// Stat strip for the Approvals tab, and the signal the frontend uses to
// decide whether to show that tab at all. "pending" (and the three other
// counts) are scoped to HR/Admin's whole org, or a plain Manager's own
// reports (same reportingHead name-match as everywhere else here).
// "canApprove" additionally stays true for a manager with direct reports
// even when their queue is currently empty — the tab shouldn't disappear
// just because nothing's pending right now.
router.get('/approvals/summary', authenticate, asyncHandler(async (req, res) => {
  const caller = await resolveCallerContext(req);

  const hasReports = !caller.isHr && caller.displayName
    ? await Onboarding.exists({
        reportingHead: { $regex: `^${escapeRegex(caller.displayName)}$`, $options: 'i' },
        exitStatus: { $nin: ['Left', 'Already Left'] },
      })
    : false;

  if (!caller.isHr && !hasReports) {
    return res.json({ success: true, data: { pending: 0, approvedThisMonth: 0, refused: 0, onLeaveToday: 0, canApprove: false } });
  }

  const all = await LeaveRequest.find({}).lean();
  const inScope = caller.isHr ? all : all.filter((r) => normalizeName(r.reportingHead) === caller.ownName);

  const typeIds = [...new Set(inScope.map((d) => String(d.leaveTypeId)))];
  const types = await LeaveType.find({ _id: { $in: typeIds } }).lean();
  const typeById = new Map(types.map((t) => [String(t._id), t]));

  const pending = inScope.filter((r) =>
    ['to_approve', 'second_approval'].includes(r.status) &&
    getAllowedActions(r, typeById.get(String(r.leaveTypeId)), caller).canApprove
  ).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const approvedThisMonth = inScope.filter((r) => {
    if (r.status !== 'approved') return false;
    const decidedAt = r.hrDecision?.at || r.managerDecision?.at;
    return decidedAt && new Date(decidedAt) >= monthStart;
  }).length;

  const refused = inScope.filter((r) => r.status === 'refused').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const onLeaveToday = inScope.filter((r) =>
    r.status === 'approved' && new Date(r.dateFrom) <= today && new Date(r.dateTo) >= today
  ).length;

  res.json({ success: true, data: { pending, approvedThisMonth, refused, onLeaveToday, canApprove: true } });
}));

// GET the built-on-demand draft for the one mail type currently applicable
// (or any type, for re-viewing — the route doesn't force it to match
// getMailAction's "pending" pick, only that it's valid for the current
// status and not already sent).
router.get('/requests/:id/mail/:mailType/draft', authenticate, asyncHandler(async (req, res) => {
  const { mailType } = req.params;
  if (!MAIL_TYPES.includes(mailType)) {
    return res.status(400).json({ success: false, message: 'Unknown mail type' });
  }

  const request = await LeaveRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  const leaveType = await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  if (!(MAIL_TYPE_FOR_STATUS[request.status] || []).includes(mailType)) {
    return res.status(400).json({ success: false, message: `This mail doesn't apply to the current status ('${request.status}')` });
  }
  if (request.mails?.[mailType]?.sentAt) {
    return res.status(409).json({ success: false, message: 'This mail has already been sent' });
  }

  const caller = await resolveCallerContext(req);
  if (!canSendMail(mailType, request, caller)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to send this mail' });
  }

  const { to, cc, warning } = await resolveMailRecipients(mailType, request, leaveType);
  res.json({
    success: true,
    data: {
      to, cc, bcc: '',
      subject: leaveMailSubject(mailType, request, leaveType),
      html: leaveMailHtml(mailType, request, leaveType),
      warning,
    },
  });
}));

router.post('/requests/:id/mail/:mailType/send', authenticate, asyncHandler(async (req, res) => {
  const { mailType } = req.params;
  if (!MAIL_TYPES.includes(mailType)) {
    return res.status(400).json({ success: false, message: 'Unknown mail type' });
  }

  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  const leaveType = await LeaveType.findById(request.leaveTypeId).lean();
  if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

  if (!(MAIL_TYPE_FOR_STATUS[request.status] || []).includes(mailType)) {
    return res.status(400).json({ success: false, message: `This mail doesn't apply to the current status ('${request.status}')` });
  }
  if (request.mails?.[mailType]?.sentAt) {
    return res.status(409).json({ success: false, message: 'This mail has already been sent' });
  }

  const caller = await resolveCallerContext(req);
  if (!canSendMail(mailType, request, caller)) {
    return res.status(403).json({ success: false, message: 'You are not authorized to send this mail' });
  }

  const { to, cc, bcc, subject } = req.body;
  const toList = splitEmails(to);
  const ccList = splitEmails(cc);
  const bccList = splitEmails(bcc);
  if (toList.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one To address is required' });
  }
  const invalid = [...toList, ...ccList, ...bccList].find((addr) => !EMAIL_REGEX.test(addr));
  if (invalid) {
    return res.status(400).json({ success: false, message: `Invalid email address: ${invalid}` });
  }
  if (!subject?.trim()) {
    return res.status(400).json({ success: false, message: 'Subject is required' });
  }

  const safeHtml = sanitizeHtml(req.body.html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'span', 'hr']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style'],
      a: ['href', 'name', 'target', 'style'],
      img: ['src', 'alt', 'style'],
    },
  });

  const result = await sendEmail({
    to: toList.join(','),
    cc: ccList.length ? ccList.join(',') : undefined,
    bcc: bccList.length ? bccList.join(',') : undefined,
    subject: subject.trim(),
    html: safeHtml,
  });
  if (!result.success) {
    // Flag deliberately left unset — a failed send must be retryable.
    return res.status(502).json({ success: false, message: result.error?.message || 'Failed to send mail' });
  }

  const by = caller.displayName;
  request.mails[mailType] = {
    sentAt: new Date(), sentBy: by,
    to: toList.join(','), cc: ccList.join(','), bcc: bccList.join(','), subject: subject.trim(),
  };
  addAudit(request, `mail_sent_${mailType}`, by, `Sent to ${toList.join(', ')}`);

  const saved = await request.save();
  res.json({ success: true, data: await enrichWithPermissions(saved, req) });
}));

// ─── Document upload ──────────────────────────────────────────────────────────

const uploadLeaveDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Invalid file type — use PDF, Word, or an image.'));
  },
}).single('file');

router.post('/requests/:id/upload-document', authenticate, uploadLeaveDoc, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file was selected' });

  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
  if (request.status !== 'draft') {
    return res.status(400).json({ success: false, message: 'A document can only be attached while the request is still a draft' });
  }

  const parentFolderId = process.env.GOOGLE_DRIVE_LEAVE_FOLDER_ID || process.env.GOOGLE_DRIVE_RESUME_FOLDER_ID;
  const driveLink = await uploadFileToDrive(
    req.file.buffer, req.file.originalname, req.file.mimetype,
    parentFolderId, { makePublic: false }
  );

  request.document = { fileName: req.file.originalname, driveLink, uploadedAt: new Date() };
  const saved = await request.save();
  res.json({ success: true, data: saved });
}));

module.exports = router;
