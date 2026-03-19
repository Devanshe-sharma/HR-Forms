const express       = require('express');
const router        = express.Router();
const Confirmations = require('../models/Confirmations');
const Employee      = require('../models/Employee');

const err = (res, code, msg) => res.status(code).json({ success: false, message: msg });

// ─── Date parser ──────────────────────────────────────────────────────────────

function parseJoiningDate(raw) {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return null;
  const s = raw.trim();

  // DD/MM/YYYY
  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    const d = new Date(`${dmySlash[3]}-${dmySlash[2].padStart(2,'0')}-${dmySlash[1].padStart(2,'0')}`);
    if (!isNaN(d)) return d;
  }

  // DD-MM-YYYY
  const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyDash) {
    const d = new Date(`${dmyDash[3]}-${dmyDash[2].padStart(2,'0')}-${dmyDash[1].padStart(2,'0')}`);
    if (!isNaN(d)) return d;
  }

  // YYYY-MM-DD or any parseable string
  const fallback = new Date(s);
  if (!isNaN(fallback)) return fallback;

  return null;
}

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

// ─── Get eligible employees (joined in last 6 months) ─────────────────────────

async function getEligibleEmployees() {
  const allEmployees = await Employee
    .find({})
    .select('_id employee_id full_name department designation joining_date level official_email')
    .lean();

  const now          = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return allEmployees.filter(emp => {
    const joined = parseJoiningDate(emp.joining_date);
    if (!joined) return false;
    return joined >= sixMonthsAgo && joined <= now;
  });
}

// ─── Create confirmation record for one employee ──────────────────────────────

async function createRecord(emp) {
  return Confirmations.create({
    employeeId   : emp._id,
    employeeCode : emp.employee_id    || '',
    employeeName : emp.full_name      || 'Unknown',
    department   : emp.department     || '',
    designation  : emp.designation    || '',
    joiningDate  : emp.joining_date   || '',
    level        : emp.level          || 1,
    email        : emp.official_email || '',
    currentStatus: 'probation',
    stage        : 'pending_manager',
    history      : [{
      status       : 'probation',
      reason       : 'Record auto-created on joining',
      changedBy    : 'system',
      changedByName: 'System',
      date         : new Date(),
    }],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES — all named routes MUST come before /:id
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/confirmations ───────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const eligible = await getEligibleEmployees();
    let created = 0;

    for (const emp of eligible) {
      try {
        const exists = await Confirmations.findOne({ employeeId: emp._id });
        if (exists) continue;
        await createRecord(emp);
        created++;
        console.log(`[Confirmations] ✅ Created: ${emp.full_name}`);
      } catch (e) {
        console.log(`[Confirmations] ⚠️  Skip ${emp.full_name}: ${e.message}`);
      }
    }

    console.log(`[Confirmations] Sync done — eligible: ${eligible.length}, created: ${created}`);

    const records = await Confirmations.find().sort({ joiningDate: -1 }).lean();
    res.json({ success: true, data: records });
  } catch (e) {
    console.error('[Confirmations] GET / error:', e.message);
    err(res, 500, 'Failed to fetch confirmations');
  }
});

// ─── GET /api/confirmations/debug ─────────────────────────────────────────────

router.get('/debug', async (req, res) => {
  try {
    const allEmployees = await Employee
      .find({})
      .select('_id employee_id full_name joining_date')
      .lean();

    const now          = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const rows = allEmployees.map(emp => {
      const parsed  = parseJoiningDate(emp.joining_date);
      const inRange = parsed ? (parsed >= sixMonthsAgo && parsed <= now) : false;
      return {
        name         : emp.full_name,
        joining_date : emp.joining_date,
        parsed       : parsed ? parsed.toISOString().split('T')[0] : 'FAILED TO PARSE',
        inLast6Months: inRange,
      };
    });

    const confirmationCount = await Confirmations.countDocuments();

    res.json({
      success          : true,
      totalEmployees   : allEmployees.length,
      sixMonthsAgo     : sixMonthsAgo.toISOString().split('T')[0],
      today            : now.toISOString().split('T')[0],
      eligibleCount    : rows.filter(r => r.inLast6Months).length,
      confirmationRows : confirmationCount,
      sample           : rows.slice(0, 10),
      eligible         : rows.filter(r => r.inLast6Months),
    });
  } catch (e) {
    err(res, 500, 'Debug failed: ' + e.message);
  }
});

// ─── GET /api/confirmations/force-sync ───────────────────────────────────────
// Wipe + recreate all records for currently eligible employees.
// Hit this in browser: http://localhost:5000/api/confirmations/force-sync

router.get('/force-sync', async (req, res) => {
  try {
    const eligible    = await getEligibleEmployees();
    const eligibleIds = eligible.map(e => e._id);

    // Delete existing records for eligible employees only
    const deleted = await Confirmations.deleteMany({ employeeId: { $in: eligibleIds } });
    console.log(`[Confirmations] Force-sync: deleted ${deleted.deletedCount} records`);

    let created = 0;
    for (const emp of eligible) {
      await createRecord(emp);
      created++;
      console.log(`[Confirmations] ✅ Re-created: ${emp.full_name}`);
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
// Non-destructive sync — only creates missing records

router.get('/sync', async (req, res) => {
  try {
    const eligible = await getEligibleEmployees();
    let created = 0;

    for (const emp of eligible) {
      const exists = await Confirmations.findOne({ employeeId: emp._id });
      if (exists) continue;
      await createRecord(emp);
      created++;
    }

    res.json({ success: true, eligible: eligible.length, created });
  } catch (e) {
    err(res, 500, 'Sync failed: ' + e.message);
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
    res.json({ success: true, data: record });
  } catch (e) {
    err(res, 500, 'Failed to submit manager decision');
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