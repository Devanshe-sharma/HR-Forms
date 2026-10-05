const LeaveAllocation = require('../models/LeaveAllocation');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');

const PENDING_STATUSES = ['to_approve', 'second_approval'];

// Per leave type: allocated (sum of approved allocations valid as of `asOf`),
// used (approved requests), pending (requests awaiting a decision),
// available = allocated - used - pending. Excludes a request via
// `excludeRequestId` so re-validating an edit-in-place doesn't double-count
// its own still-pending duration.
async function computeLeaveBalance(employeeId, { asOf = new Date(), excludeRequestId = null } = {}) {
  const [types, allocations, requests] = await Promise.all([
    LeaveType.find({ isActive: true }).lean(),
    LeaveAllocation.find({
      employeeId,
      status: 'approved',
      validFrom: { $lte: asOf },
      $or: [{ validTo: null }, { validTo: { $gte: asOf } }],
    }).lean(),
    LeaveRequest.find({
      employeeId,
      status: { $in: [...PENDING_STATUSES, 'approved'] },
      ...(excludeRequestId ? { _id: { $ne: excludeRequestId } } : {}),
    }).lean(),
  ]);

  const byType = {};
  for (const t of types) {
    byType[String(t._id)] = {
      leaveTypeId: String(t._id),
      name: t.name,
      code: t.code,
      color: t.color,
      isPaid: t.isPaid,
      allowNegativeBalance: t.allowNegativeBalance,
      requiresDocument: t.requiresDocument,
      requiresAllocation: t.requiresAllocation,
      maxDaysPerRequest: t.maxDaysPerRequest,
      approvalMode: t.approvalMode,
      allocated: 0,
      used: 0,
      pending: 0,
      available: 0,
    };
  }

  for (const a of allocations) {
    const row = byType[String(a.leaveTypeId)];
    if (row) row.allocated += a.days;
  }
  for (const r of requests) {
    const row = byType[String(r.leaveTypeId)];
    if (!row) continue;
    if (r.status === 'approved') row.used += r.durationDays;
    else row.pending += r.durationDays;
  }
  for (const row of Object.values(byType)) {
    row.available = row.allocated - row.used - row.pending;
  }

  return Object.values(byType);
}

module.exports = { computeLeaveBalance, PENDING_STATUSES };
