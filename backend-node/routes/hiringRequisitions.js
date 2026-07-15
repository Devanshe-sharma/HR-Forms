const express           = require('express');
const { parse: parseCsv } = require('csv-parse/sync');
const router            = express.Router();
const HiringRequisition = require('../models/HiringRequisition');
const { triggerNewRequisition, triggerUpdateRequisition } = require('../emails');

// ─── Checklist scoring ──────────────────────────────────────────────────────
// Mirrors the exact same 3-branch logic used by the Exit module's FMS
// scoring: for each task, compare its plan date and done date against
// today to determine score/status/daysLeft, then aggregate totals.
function scoreChecklistTasks(tasks, today = new Date()) {
  today = new Date(today);
  today.setHours(0, 0, 0, 0);

  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0, tasksDue = 0, notYetDue = 0, fmsScore = 0;

  const scored = (tasks || []).map((t) => {
    const plan = t.plan ? new Date(t.plan) : null;
    const done = t.done ? new Date(t.done) : null;
    let score = null, status = '', daysLeft = null;

    if (done) {
      // Completed — lateness is judged against the plan date directly,
      // never against "today" (when the task was actually finished
      // doesn't change just because someone happens to check on it
      // later). Never positive: 0 if on time or early, negative per day
      // late otherwise.
      if (plan) {
        const rawDiff = Math.round((plan.getTime() - done.getTime()) / (1000 * 60 * 60 * 24));
        score = Math.min(0, rawDiff);
        if (score < 0) {
          status = 'Done (Delayed)';
          doneButDelayed++;
        } else {
          status = 'Done';
          doneInTime++;
        }
      } else {
        // Done with no plan ever set — can't be judged late against
        // nothing, so it's simply on time.
        score = 0;
        status = 'Done';
        doneInTime++;
      }
    } else if (plan) {
      if (plan.getTime() - today.getTime() < 0) {
        // Overdue — not done, and the deadline has passed. -1 per day late.
        score = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        status = 'Overdue';
        daysLeft = score;
        tasksOverdue++;
      } else {
        // Not yet due, but a deadline is scheduled.
        status = 'Pending';
        daysLeft = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        tasksDue++;
      }
    } else {
      // No plan date and not done yet.
      status = 'Not Yet Due';
      notYetDue++;
    }

    if (typeof score === 'number') fmsScore += score;

    return {
      task: t.task,
      plan: t.plan || null,
      done: t.done || null,
      score,
      status,
      daysLeft,
    };
  });

  return {
    checklist_tasks: scored,
    total_tasks:      scored.length,
    done_in_time:     doneInTime,
    done_but_delayed: doneButDelayed,
    tasks_overdue:    tasksOverdue,
    tasks_due:        tasksDue,
    not_yet_due:      notYetDue,
    fms_score:        fmsScore,
  };
}

// Re-scores a saved document's checklist and persists the computed fields.
// Call this any time checklist_tasks (or anything date-related) changes.
async function rescoreAndSave(id) {
  const doc = await HiringRequisition.findById(id);
  if (!doc) return null;

  const scored = scoreChecklistTasks(doc.checklist_tasks);
  doc.checklist_tasks  = scored.checklist_tasks;
  doc.total_tasks      = scored.total_tasks;
  doc.done_in_time     = scored.done_in_time;
  doc.done_but_delayed = scored.done_but_delayed;
  doc.tasks_overdue    = scored.tasks_overdue;
  doc.tasks_due        = scored.tasks_due;
  doc.not_yet_due      = scored.not_yet_due;
  doc.fms_score        = scored.fms_score;

  await doc.save();
  return doc;
}

// The actual HR checklist tasks — mirrors HR_CHECKLISTS in
// Real task names confirmed against both the legacy sheet's column headers
// and actual existing MongoDB documents — replaces an earlier guess that
// was based on the New Requisition form's (purely decorative) checklist
// display, which used different wording than the real data.
const HR_CHECKLIST_TASK_NAMES = [
  'Role n JD Checked',
  'Checked Internally for Candidates',
  'Emailed Internally For References',
  'Emailed Others For Reference',
  'Thanked All Applicants',
  'Emailed Shortlisted Candidates',
  'All Interviews Logged',
  'Asked Interviewers To Use Role Doc',
  'Asked Interviewers to Use Tests',
  'Asked Interviewers To Hire Only Best',
  'Asked Confirmation in 2 Days',
  'Kept All in Cc',
];

function seedChecklistTasks() {
  return HR_CHECKLIST_TASK_NAMES.map((task) => ({
    task, plan: null, done: null, score: null, status: '', daysLeft: null,
  }));
}

// Parses the sheet's "07 Apr 26" / "18 Mar 26" date format.
function parseSheetDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;

  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = months[m[2]];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (month !== undefined) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ─── POST /api/hiringrequisitions/import-legacy-checklist-csv ─────────────────
// Accepts the raw legacy sheet CSV as text/plain body. Matches each row to
// an existing MongoDB document by "Message Id" (the one genuinely unique
// key in the sheet — "Ser" repeats across unrelated rows and can't be
// trusted for matching). For each match, rebuilds checklist_tasks from the
// sheet's own Plan/Done dates and recomputes score/status/daysLeft and all
// aggregates FRESH via scoreChecklistTasks() — deliberately ignoring the
// sheet's own Score/Status/aggregate columns, since those were confirmed
// stale/inconsistent with each other in the source data itself.
// Also backfills a small set of fields that are blank in Mongo but present
// in the sheet — never overwrites something already filled in.
router.post('/import-legacy-checklist-csv', express.text({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    const csvText = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, error: 'Raw CSV text body required' });
    }

    const rows = parseCsv(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    });

    let matched = 0, updated = 0, skippedNoMessageId = 0;
    const unmatched = [];

    for (const row of rows) {
      const messageId = (row['Message Id'] || '').trim();
      if (!messageId) {
        skippedNoMessageId++;
        continue;
      }

      const doc = await HiringRequisition.findOne({ message_id: messageId });
      if (!doc) {
        unmatched.push({ ser: row['Ser'], designation: row['Designation'], message_id: messageId });
        continue;
      }
      matched++;

      const freshTasks = HR_CHECKLIST_TASK_NAMES.map((taskName) => ({
        task: taskName,
        plan: parseSheetDate(row[`${taskName} Plan?`]),
        done: parseSheetDate(row[`${taskName} Done?`]),
      }));
      const scored = scoreChecklistTasks(freshTasks);

      doc.checklist_tasks  = scored.checklist_tasks;
      doc.total_tasks      = scored.total_tasks;
      doc.done_in_time     = scored.done_in_time;
      doc.done_but_delayed = scored.done_but_delayed;
      doc.tasks_overdue    = scored.tasks_overdue;
      doc.tasks_due        = scored.tasks_due;
      doc.not_yet_due      = scored.not_yet_due;
      doc.fms_score        = scored.fms_score;

      const backfillIfBlank = (field, sheetValue) => {
        if (!doc[field] && sheetValue) doc[field] = sheetValue;
      };
      backfillIfBlank('role_link', row['Role Link']);
      backfillIfBlank('jd_link', row['JD Link']);
      backfillIfBlank('hiring_dept_email', row['Hiring Dept Email']);
      backfillIfBlank('hr_remarks', row['HR Remarks']);
      backfillIfBlank('special_instructions', row['Special Instructions To HR']);
      backfillIfBlank('not_accepted_joined_reason', row['Not Accepted/Joined Reason']);
      backfillIfBlank('hiring_closed_reason', row['Hiring Closed Reason']);
      if (!doc.budget && row['Budget']) {
        const b = Number(row['Budget']);
        if (!isNaN(b)) doc.budget = b;
      }
      backfillIfBlank('assigned_to', row['Assigned To']);

      await doc.save();
      updated++;
    }

    res.json({
      success: true,
      message: `Matched ${matched} record(s) by Message Id, updated ${updated}. ${skippedNoMessageId} sheet row(s) had no Message Id and were skipped. ${unmatched.length} had a Message Id but no matching MongoDB record.`,
      unmatched,
    });
  } catch (err) {
    console.error('[hiringrequisitions] CSV import error:', err.message);
    res.status(500).json({ success: false, error: 'Import failed: ' + err.message });
  }
});

// POST /api/hiringrequisitions/backfill-checklists — one-time fix for
// requisitions created before checklist seeding existed.
router.post('/backfill-checklists', async (req, res) => {
  try {
    const docs = await HiringRequisition.find({
      $or: [{ checklist_tasks: { $size: 0 } }, { checklist_tasks: { $exists: false } }],
    });

    let updated = 0;
    for (const doc of docs) {
      const scored = scoreChecklistTasks(seedChecklistTasks());
      doc.checklist_tasks  = scored.checklist_tasks;
      doc.total_tasks      = scored.total_tasks;
      doc.done_in_time     = scored.done_in_time;
      doc.done_but_delayed = scored.done_but_delayed;
      doc.tasks_overdue    = scored.tasks_overdue;
      doc.tasks_due        = scored.tasks_due;
      doc.not_yet_due      = scored.not_yet_due;
      doc.fms_score        = scored.fms_score;
      await doc.save();
      updated++;
    }

    res.json({ success: true, message: `Seeded checklist on ${updated} requisition(s)` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Backfill failed: ' + err.message });
  }
});

// GET /api/hiringrequisitions/next-serial
router.get('/next-serial', async (req, res) => {
  try {
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    res.json({ success: true, next_serial: latest ? latest.serial_no + 1 : 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get next serial' });
  }
});

// GET /api/hiringrequisitions/open — public job postings
router.get('/open', async (req, res) => {
  try {
    const jobs = await HiringRequisition.find({ fmsStatus: 'Open' })
      .select('serial_no designation hiring_dept candidate_experience_level role_link jd_link createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch open positions' });
  }
});

// GET /api/hiringrequisitions/ — fetch all for dashboard (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status, dept, fmsStatus, search } = req.query;
    const filter = {};

    if (status)    filter.hiring_status = status;
    if (dept)      filter.hiring_dept   = dept;
    if (fmsStatus) filter.fmsStatus     = fmsStatus;
    if (search) {
      filter.$or = [
        { designation:          { $regex: search, $options: 'i' } },
        { requisitioner_name:   { $regex: search, $options: 'i' } },
        { hiring_dept:          { $regex: search, $options: 'i' } },
        { special_instructions: { $regex: search, $options: 'i' } },
      ];
    }

    // request_date is stored as a plain string like "18 Mar 26" — sorting
    // that directly in MongoDB would compare it alphabetically (wrong: e.g.
    // "07 Apr 26" would sort before "18 Mar 26" since '0' < '1'). Parse it
    // properly and sort in JS instead, so the actual latest request date
    // genuinely comes first.
    let data = await HiringRequisition.find(filter).lean();
    data.sort((a, b) => {
      const da = parseSheetDate(a.request_date);
      const db = parseSheetDate(b.request_date);
      if (!da && !db) return 0;
      if (!da) return 1;  // unparseable/missing dates sink to the bottom
      if (!db) return -1;
      return db.getTime() - da.getTime(); // descending — latest first
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch hiring requisitions' });
  }
});

// GET /api/hiringrequisitions/:id — single record
router.get('/:id', async (req, res) => {
  try {
    const doc = await HiringRequisition.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch record' });
  }
});

// POST /api/hiringrequisitions/ — create new requisition
router.post('/', async (req, res) => {
  try {
    // Re-derive serial at save time — not trusting form's earlier fetch
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    const serial_no = latest ? latest.serial_no + 1 : 1;

    // Score the checklist at creation time. The frontend doesn't submit
    // checklist_tasks at all today (they're shown as disabled/informational
    // only), so always seed the real 12-item list here rather than trusting
    // req.body — this is what gives scoring something to work with.
    const seedTasks = req.body.checklist_tasks?.length ? req.body.checklist_tasks : seedChecklistTasks();
    const scored = scoreChecklistTasks(seedTasks);

    const doc = await HiringRequisition.create({
      ...req.body,
      serial_no,
      checklist_tasks:  scored.checklist_tasks,
      total_tasks:      scored.total_tasks,
      done_in_time:     scored.done_in_time,
      done_but_delayed: scored.done_but_delayed,
      tasks_overdue:    scored.tasks_overdue,
      tasks_due:        scored.tasks_due,
      not_yet_due:      scored.not_yet_due,
      fms_score:        scored.fms_score,
    });

    // Fire-and-forget, same pattern as onboarding's triggerNewOnboarding —
    // never block the response on email delivery.
    triggerNewRequisition(doc).catch(console.error);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('[hiringrequisitions POST]', err);
    res.status(500).json({ success: false, error: 'Failed to save requisition' });
  }
});

// PATCH /api/hiringrequisitions/:id — update any fields (dashboard edits)
router.patch('/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, serial_no, ...updates } = req.body;

    // Append a history entry
    const historyEntry = {
      note: `Status updated to "${updates.hiring_status || 'N/A'}" — ${updates.hr_remarks || ''}`,
      changedBy: updates.changedBy || 'HR',
      date: new Date(),
    };

    let doc = await HiringRequisition.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
        $push: { hiring_history: historyEntry },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });

    // Whatever changed, re-score the checklist against today's date so
    // status/score/daysLeft and the aggregate counters stay accurate even
    // when nothing about the checklist itself was touched (e.g. a day
    // passing can turn "Pending" into "Overdue").
    doc = await rescoreAndSave(doc._id);

    // Fire-and-forget update email — routes to the cancellation email or
    // the routine progress email depending on hiring_status.
    triggerUpdateRequisition(doc).catch(console.error);

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('[hiringrequisitions PATCH]', err);
    res.status(500).json({ success: false, error: 'Failed to update requisition' });
  }
});

// PATCH /api/hiringrequisitions/:id/status — status-only update (quick action from table)
router.patch('/:id/status', async (req, res) => {
  try {
    const { hiring_status, fmsStatus } = req.body;
    const updates = {};
    if (hiring_status) updates.hiring_status = hiring_status;
    if (fmsStatus)     updates.fmsStatus     = fmsStatus;

    const doc = await HiringRequisition.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// PATCH /api/hiringrequisitions/:id/checklist — update a single checklist task
router.patch('/:id/checklist', async (req, res) => {
  try {
    const { task, ...taskUpdates } = req.body;
    if (!task) return res.status(400).json({ success: false, error: 'task name required' });

    let doc = await HiringRequisition.findOneAndUpdate(
      { _id: req.params.id, 'checklist_tasks.task': task },
      { $set: Object.fromEntries(
          Object.entries(taskUpdates).map(([k, v]) => [`checklist_tasks.$.${k}`, v])
        )
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found or task not found' });

    // Re-score the whole checklist now that this task's plan/done date
    // may have changed — this is what actually computes score/status/
    // daysLeft and the fms_score/total_tasks/etc. aggregates.
    doc = await rescoreAndSave(doc._id);

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update checklist task' });
  }
});

// DELETE /api/hiringrequisitions/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await HiringRequisition.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: `Requisition #${doc.serial_no} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete requisition' });
  }
});

module.exports = router;