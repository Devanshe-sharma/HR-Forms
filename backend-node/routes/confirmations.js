const express       = require('express');
const router        = express.Router();
const Confirmations = require('../models/Confirmations');
// Onboarding is the single employee master now — replaces the old,
// separate Employee collection entirely.
const Onboarding    = require('../models/onboardingModel');

const err = (res, code, msg) => res.status(code).json({ success: false, message: msg });

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// ─── Date calculation helpers ──────────────────────────────────────────────────
// Safely add months to a date, handling month boundaries correctly

function addMonths(date, months) {
  const d = new Date(date);
  d.setDate(1);  // Go to first of month to avoid boundary issues
  d.setMonth(d.getMonth() + months);
  // Set to last day of target month if original day > target month's days
  d.setDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  return d;
}

function parseJoiningDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Get eligible employees from Onboarding ────────────────────────────────────
// "Eligible" = currently employed (not Left/Already Left) and has actually
// joined (has a joinedDate on or before today). Onboarding is read fresh on
// every call — no caching — so this always reflects the live database.
async function getEligibleEmployees() {
  const docs = await Onboarding.find(
    {},
    'name officialEmail persEmail dept designation joinedDate reportingHead exitStatus'
  ).lean();

  const now = new Date();

  return docs
    .filter((d) => !EXITED_STATUS_VALUES.has(d.exitStatus || ''))
    .filter((d) => {
      const joined = parseJoiningDate(d.joinedDate);
      return joined && joined <= now;
    })
    .map((d) => ({
      _id               : d._id,
      full_name         : d.name || 'Unknown',
      department        : d.dept || '',
      designation       : d.designation || '',
      joining_date      : d.joinedDate,
      official_email    : d.officialEmail || d.persEmail || '',
      reporting_manager : d.reportingHead || '',
    }));
}

// ─── Create confirmation record for one employee ──────────────────────────────

async function createRecord(emp) {
  return Confirmations.create({
    employeeId       : emp._id,
    employeeCode     : String(emp._id),
    employeeName     : emp.full_name         || 'Unknown',
    department       : emp.department        || '',
    designation      : emp.designation       || '',
    joiningDate      : emp.joining_date      || '',
    level            : 1, // Onboarding doesn't track a numeric level today
    email            : emp.official_email    || '',
    reportingManager : emp.reporting_manager || '',
    currentStatus    : 'probation',
    stage            : 'pending_manager',
    history          : [{
      status       : 'probation',
      reason       : 'Record auto-created on joining',
      changedBy    : 'system',
      changedByName: 'System',
      date         : new Date(),
    }],
  });
}

// ─── Refresh an existing record's employee-snapshot fields ─────────────────────
// Onboarding is the source of truth, so if a department gets corrected, a
// reporting manager changes, etc., the confirmation record's display data
// should reflect that — WITHOUT touching currentStatus, stage, decisions,
// or history, which represent real workflow progress that must never be
// reset by a data sync.
async function refreshSnapshot(existing, emp) {
  const updates = {
    employeeName    : emp.full_name         || 'Unknown',
    department      : emp.department        || '',
    designation     : emp.designation       || '',
    joiningDate     : emp.joining_date      || '',
    email           : emp.official_email    || '',
    reportingManager: emp.reporting_manager || '',
  };

  const changed = Object.keys(updates).some(
    (k) => String(existing[k] || '') !== String(updates[k] || '')
  );

  if (changed) {
    await Confirmations.findByIdAndUpdate(existing._id, updates);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES — all named routes MUST come before /:id
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/confirmations ───────────────────────────────────────────────────
// Creates missing records AND refreshes stale snapshot data on every load.

// ─── POST /api/confirmations ───────────────────────────────────────────────
// Used by the HR Decision dialog to explicitly record an initial decision
// for an employee. This route never existed before — the frontend was
// silently failing every call here and papering over it with a localStorage
// fallback, which has been removed in favor of actually fixing this gap.
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.employeeId) return err(res, 400, 'employeeId is required');

    const existing = await Confirmations.findOne({ employeeId: body.employeeId });
    if (existing) {
      return err(res, 409, 'A confirmation record already exists for this employee');
    }

    const record = await Confirmations.create({
      employeeId       : body.employeeId,
      employeeCode     : body.employeeCode     || '',
      employeeName     : body.employeeName     || 'Unknown',
      department       : body.department       || '',
      designation      : body.designation      || '',
      joiningDate       : body.joiningDate      || '',
      level            : body.level            || 1,
      email            : body.email            || '',
      reportingManager : body.reportingManager || '',
      currentStatus    : body.currentStatus    || 'probation',
      stage            : body.stage            || 'pending_manager',
      history          : Array.isArray(body.history) && body.history.length
        ? body.history
        : [{
            status       : body.currentStatus || 'probation',
            reason       : body.reason || '',
            changedBy    : 'hr',
            changedByName: 'HR User',
            date         : new Date(),
          }],
    });

    res.json({ success: true, data: record });
  } catch (e) {
    console.error('[Confirmations] POST / error:', e.message);
    err(res, 500, 'Failed to create confirmation record: ' + e.message);
  }
});

router.get('/', async (req, res) => {
  try {
    const eligible = await getEligibleEmployees();
    let created = 0;
    let refreshed = 0;

    for (const emp of eligible) {
      const exists = await Confirmations.findOne({ employeeId: emp._id });
      if (!exists) {
        try {
          await createRecord(emp);
          created++;
        } catch (e) {
          console.log(`[Confirmations] ⚠️  Skip ${emp.full_name}: ${e.message}`);
        }
      } else {
        const didRefresh = await refreshSnapshot(exists, emp);
        if (didRefresh) refreshed++;
      }
    }

    console.log(`[Confirmations] Sync done — eligible: ${eligible.length}, created: ${created}, refreshed: ${refreshed}`);

    const records = await Confirmations.find().sort({ joiningDate: -1 }).lean();
    res.json({ success: true, data: records, created, refreshed });
  } catch (e) {
    console.error('[Confirmations] GET / error:', e.message);
    err(res, 500, 'Failed to fetch confirmations');
  }
});

// ─── GET /api/confirmations/debug ─────────────────────────────────────────────

router.get('/debug', async (req, res) => {
  try {
    const eligible = await getEligibleEmployees();
    const confirmationCount = await Confirmations.countDocuments();

    res.json({
      success       : true,
      eligibleCount : eligible.length,
      confirmationRows: confirmationCount,
      sample        : eligible.slice(0, 10).map((e) => ({
        name        : e.full_name,
        department  : e.department,
        joining_date: e.joining_date,
      })),
    });
  } catch (e) {
    err(res, 500, 'Debug failed: ' + e.message);
  }
});

// ─── GET /api/confirmations/force-sync ───────────────────────────────────────
// Wipe + recreate all records for currently eligible employees.
// ⚠️  This destroys existing workflow decisions/history — use only for
// resetting test data, not on records with real progress on them.

router.get('/force-sync', async (req, res) => {
  try {
    const eligible    = await getEligibleEmployees();
    const eligibleIds = eligible.map(e => e._id);

    const deleted = await Confirmations.deleteMany({ employeeId: { $in: eligibleIds } });
    console.log(`[Confirmations] Force-sync: deleted ${deleted.deletedCount} records`);

    let created = 0;
    for (const emp of eligible) {
      await createRecord(emp);
      created++;
    }

    const records = await Confirmations.find().sort({ joiningDate: -1 }).lean();
    res.json({
      success : true,
      message : `Deleted ${deleted.deletedCount} old records, created ${created} fresh records`,
      created,
      data    : records,
    });
  } catch (e) {
    console.error('[Confirmations] Force-sync error:', e.message);
    err(res, 500, 'Force-sync failed: ' + e.message);
  }
});

// ─── GET /api/confirmations/sync ──────────────────────────────────────────────
// Non-destructive sync — creates missing records and refreshes stale ones.

router.get('/sync', async (req, res) => {
  try {
    const eligible = await getEligibleEmployees();
    let created = 0;
    let refreshed = 0;

    for (const emp of eligible) {
      const exists = await Confirmations.findOne({ employeeId: emp._id });
      if (!exists) {
        await createRecord(emp);
        created++;
      } else {
        const didRefresh = await refreshSnapshot(exists, emp);
        if (didRefresh) refreshed++;
      }
    }

    res.json({ success: true, eligible: eligible.length, created, refreshed });
  } catch (e) {
    err(res, 500, 'Sync failed: ' + e.message);
  }
});

// ─── POST /api/confirmations/bulk-confirm-before-date ─────────────────────
// One-time bulk action: every currently-employed person who joined before
// the given cutoff (default 1 Jan 2026) gets marked straight to
// Confirmed/Completed — skipping the manager/management review workflow
// entirely, since these are legacy joiners who predate this system.
// Creates a confirmation record first if one doesn't already exist.
// Safe to re-run — already-confirmed records are left untouched.
router.post('/bulk-confirm-before-date', async (req, res) => {
  try {
    const cutoffStr = req.body?.date || '2026-01-01';
    const cutoff = new Date(cutoffStr);
    if (isNaN(cutoff.getTime())) return err(res, 400, 'Invalid date — use YYYY-MM-DD format');

    const eligible = await getEligibleEmployees();
    const beforeCutoff = eligible.filter((emp) => {
      const joined = parseJoiningDate(emp.joining_date);
      return joined && joined < cutoff;
    });

    let created = 0, confirmed = 0, alreadyConfirmed = 0;

    for (const emp of beforeCutoff) {
      let record = await Confirmations.findOne({ employeeId: emp._id });

      if (!record) {
        record = await createRecord(emp);
        created++;
      }

      if (record.currentStatus === 'confirmed' && record.stage === 'completed') {
        alreadyConfirmed++;
        continue;
      }

      record.currentStatus = 'confirmed';
      record.stage = 'completed';
      record.history.push({
        status: 'confirmed',
        reason: `Bulk-confirmed: joined before ${cutoff.toISOString().split('T')[0]}`,
        changedBy: 'system',
        changedByName: 'System (Bulk Confirm)',
        date: new Date(),
      });
      await record.save();
      confirmed++;
    }

    res.json({
      success: true,
      message: `${beforeCutoff.length} employee(s) joined before ${cutoffStr}. Created ${created} new record(s), confirmed ${confirmed}, ${alreadyConfirmed} were already confirmed.`,
    });
  } catch (e) {
    console.error('[Confirmations] Bulk confirm error:', e.message);
    err(res, 500, 'Bulk confirm failed: ' + e.message);
  }
});

// ─── GET /api/confirmations/:id ───────────────────────────────────────────────
// ⚠️  This must stay AFTER all named GET routes above

router.get('/:id', async (req, res) => {
  try {
    const record = await Confirmations.findById(req.params.id).lean();
    if (!record) return err(res, 404, 'Confirmation not found');
    res.json({ success: true, data: record });
  } catch (e) {
    err(res, 500, 'Failed to fetch confirmation');
  }
});

// ─── PUT /api/confirmations/:id/manager ───────────────────────────────────────

router.put('/:id/manager', async (req, res) => {
  try {
    const { status, reason, monthsExtended, changedByName } = req.body;

    if (!status || !reason)
      return err(res, 400, 'status and reason are required');
    if (!['probation', 'confirmed', 'extended', 'not_confirmed'].includes(status))
      return err(res, 400, 'Invalid status value');
    if (status === 'extended' && (!monthsExtended || monthsExtended < 1))
      return err(res, 400, 'monthsExtended (min 1) is required when extending');

    const record = await Confirmations.findById(req.params.id);
    if (!record) return err(res, 404, 'Confirmation not found');
    if (record.stage !== 'pending_manager')
      return err(res, 400, 'Manager already submitted or record is completed');

    // ─── Handle manager extension flow ───────────────────────────────────────
    const managerDecisionObj = {
      status,
      reason,
      monthsExtended : status === 'extended' ? Number(monthsExtended) : null,
      submittedAt    : new Date(),
    };

    // If manager recommends extension, calculate dates now
    if (status === 'extended') {
      const months = Number(monthsExtended);

      // Calculate base review date: use existing reviewDate or calculate from joining date
      let baseReviewDate = record.reviewDate;
      if (!baseReviewDate) {
        const joined = parseJoiningDate(record.joiningDate);
        if (joined) {
          baseReviewDate = new Date(joined);
          baseReviewDate.setMonth(baseReviewDate.getMonth() + 6);
        } else {
          baseReviewDate = new Date();
        }
      }

      const extendedTillDate = addMonths(baseReviewDate, months);
      const reviewDateObj = addMonths(baseReviewDate, months - 1);

      if (reviewDateObj >= extendedTillDate) {
        return err(res, 400, 'Review date must be before extension end date');
      }

      record.extendedMonths = months;
      record.extendedTill   = extendedTillDate;
      record.reviewDate     = reviewDateObj;
    }

    record.managerDecision = managerDecisionObj;
    record.currentStatus = status;
    record.stage         = 'pending_management';
    record.history.push({
      status, reason,
      monthsExtended : status === 'extended' ? Number(monthsExtended) : null,
      changedBy      : 'manager',
      changedByName  : changedByName || 'Manager',
      date           : new Date(),
    });

    await record.save();

    // NOTE: previously this wrote a "joining_status" field back onto the
    // old, separate Employee collection. That collection is no longer the
    // source of truth (Onboarding is), and Onboarding doesn't currently
    // have an equivalent confirmation-status field to write back to. If
    // you want confirmation outcomes reflected back onto the employee's
    // Onboarding record, tell us which field should hold that and we'll
    // wire it up properly rather than guessing at one.

    res.json({ success: true, data: record });
  } catch (e) {
    err(res, 500, 'Failed to submit management decision');
  }
});

// ─── PUT /api/confirmations/:id/management ────────────────────────────────────

router.put('/:id/management', async (req, res) => {
  try {
    const { status, reason, monthsExtended, changedByName } = req.body;

    if (!status || !reason)
      return err(res, 400, 'status and reason are required');
    if (!['probation', 'confirmed', 'extended', 'not_confirmed'].includes(status))
      return err(res, 400, 'Invalid status value');
    if (status === 'extended' && (!monthsExtended || monthsExtended < 1))
      return err(res, 400, 'monthsExtended (min 1) is required when extending');

    const record = await Confirmations.findById(req.params.id);
    if (!record) return err(res, 404, 'Confirmation not found');
    if (record.stage !== 'pending_management')
      return err(res, 400, 'Manager must submit first, or record is already completed');

    record.managementDecision = {
      status,
      reason,
      monthsExtended : status === 'extended' ? Number(monthsExtended) : null,
      submittedAt    : new Date(),
    };
    record.currentStatus = status;

    // ─── Handle extension flow ────────────────────────────────────────────────
    if (status === 'extended') {
      const months = Number(monthsExtended);

      // Calculate base review date: use existing reviewDate or calculate from joining date
      let baseReviewDate = record.reviewDate;
      if (!baseReviewDate) {
        const joined = parseJoiningDate(record.joiningDate);
        if (joined) {
          baseReviewDate = new Date(joined);
          baseReviewDate.setMonth(baseReviewDate.getMonth() + 6);
        } else {
          baseReviewDate = new Date();
        }
      }

      const extendedTillDate = addMonths(baseReviewDate, months);
      const reviewDateObj = addMonths(baseReviewDate, months - 1);

      // Validate that reviewDate < extendedTill
      if (reviewDateObj >= extendedTillDate) {
        return err(res, 400, 'Review date must be before extension end date');
      }

      record.extendedMonths = months;
      record.extendedTill   = extendedTillDate;
      record.reviewDate     = reviewDateObj;
      record.stage          = 'on_hold';  // ← Don't complete, put on hold
    } else {
      // Other statuses (confirmed, not_confirmed) complete process
      record.stage = 'completed';
    }

    record.history.push({
      status, reason,
      monthsExtended : status === 'extended' ? Number(monthsExtended) : null,
      changedBy      : 'management',
      changedByName  : changedByName || 'Management',
      date           : new Date(),
    });

    await record.save();
    res.json({ success: true, data: record });
  } catch (e) {
    err(res, 500, 'Failed to submit management decision');
  }
});

module.exports = router;