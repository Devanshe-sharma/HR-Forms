const express           = require('express');
const { parse: parseCsv } = require('csv-parse/sync');
const router            = express.Router();
const HiringRequisition = require('../models/HiringRequisition');
const { triggerNewRequisition, triggerUpdateRequisition, triggerReferralInvite } = require('../emails');
const resolveJdAndRoleLinks = require('../utils/resolveJdAndRoleLinks');

// hiring_status values that mean this requisition is over — regardless
// of whether every checklist task got ticked. "On Hold" doesn't mean
// someone forgot to finish the checklist, it means hiring isn't
// actively progressing anymore and shouldn't keep showing as Open just
// because a task like "Tea Party" never got checked. "Cancelled" is
// this system's equivalent of the old sheet's "Hiring Stopped" status
// (see the note in sendRequisitionCancelled.js). "Not Accepted" and
// "Not Joined" were deliberately removed from this set — those cases
// still want the checklist to genuinely be completed before closing,
// rather than auto-closing just from the status alone.
const HIRING_STATUS_FORCES_CLOSED = new Set([
  "On Hold",
  "Joined",
  "Cancelled",
]);

// hiring_status values where checklist SCORING (not fmsStatus — that's a
// completely separate concept, governed only by HIRING_STATUS_FORCES_
// CLOSED above) is held in a neutral state. While the process is
// waiting on something outside HR's own control — a candidate deciding
// on an offer, or the aftermath of a decline/no-show — a task with a
// passed plan date shouldn't accrue an "Overdue" penalty the same way
// it would if HR were simply behind schedule. Tasks that would
// otherwise be marked Overdue are instead marked "On Hold": no score
// penalty, not counted as genuinely overdue. fmsStatus itself is
// entirely unaffected by this and stays computed exactly as before.
const HIRING_STATUS_SCORING_ON_HOLD = new Set([
  "Offer Sent",
  "Not Accepted",
  "Not Joined",
]);

// ─── Checklist scoring ──────────────────────────────────────────────────────
// Mirrors the exact same 3-branch logic used by the Exit module's FMS
// scoring: for each task, compare its plan date and done date against
// today to determine score/status/daysLeft, then aggregate totals.
//
// Two fixes bundled in here:
// 1. plan/done are now normalized to midnight before any diff, matching
//    the treatment today already got — previously only today was
//    zeroed, so a task's real done timestamp (whatever time someone
//    actually ticked the checkbox) could throw the day-count off by
//    exactly one day even when it was genuinely done on time on the
//    correct calendar day.
// 2. fms_status is now computed HERE, automatically, from whether every
//    task is Done/Done(Delayed) — mirroring the old Apps Script's
//    "if (tasksNotDone === 0) fmsStatus = Closed" auto-close behavior.
//    This was never ported to the Node backend at all: fmsStatus used to
//    be a pure manual toggle with no connection to checklist completion.
//    Every call site that runs this function now persists fms_status
//    directly — there is no longer any path where fmsStatus is set by
//    anything other than this calculation (or the hiring_status override
//    applied on top of it at each call site — see
//    HIRING_STATUS_FORCES_CLOSED above).
function scoreChecklistTasks(tasks, hiringStatus, isApproved, today = new Date()) {
  today = new Date(today);
  today.setHours(0, 0, 0, 0);

  // Nothing scores at all until HR has actually approved the
  // requisition — every task sits in "Awaiting Approval" with no plan,
  // no score, not counted as overdue/pending/anything else. This is
  // checked first and completely bypasses the rest of the function,
  // since a task genuinely has no meaningful plan date to judge against
  // yet (see deriveEffectiveMilestones/the approve route — plan dates
  // for all 12 tasks only actually get computed once approval happens).
  if (!isApproved) {
    const scored = (tasks || []).map((t) => ({
      task: t.task,
      plan: null,
      done: t.done || null,
      score: null,
      status: 'Awaiting Approval',
      daysLeft: null,
    }));
    return {
      checklist_tasks:  scored,
      total_tasks:      scored.length,
      done_in_time:     0,
      done_but_delayed: 0,
      tasks_overdue:    0,
      tasks_due:        0,
      not_yet_due:      scored.length,
      tasks_on_hold:    0,
      fms_score:        0,
      fms_status:       'Open',
    };
  }

  const scoringOnHold = HIRING_STATUS_SCORING_ON_HOLD.has(hiringStatus);

  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0, tasksDue = 0, notYetDue = 0, tasksOnHold = 0, fmsScore = 0;

  const scored = (tasks || []).map((t) => {
    const plan = t.plan ? new Date(t.plan) : null;
    const done = t.done ? new Date(t.done) : null;
    if (plan) plan.setHours(0, 0, 0, 0);
    if (done) done.setHours(0, 0, 0, 0);

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
        if (scoringOnHold) {
          // Would otherwise be Overdue, but hiring_status says this is
          // waiting on something outside HR's control — no penalty,
          // not counted as genuinely overdue.
          score = 0;
          status = 'On Hold';
          daysLeft = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          tasksOnHold++;
        } else {
          // Overdue — not done, and the deadline has passed. -1 per day late.
          score = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          status = 'Overdue';
          daysLeft = score;
          tasksOverdue++;
        }
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

  // Every task is either Done or Done (Delayed) — none are Overdue,
  // Pending, Not Yet Due, or On Hold — so the whole requisition
  // auto-closes. tasksOnHold counts toward "not done" here even though
  // it doesn't count toward the score penalty — a task being held from
  // penalty doesn't mean it's actually complete.
  const tasksNotDone = tasksOverdue + tasksDue + notYetDue + tasksOnHold;
  const fmsStatus = tasksNotDone === 0 ? 'Closed' : 'Open';

  return {
    checklist_tasks: scored,
    total_tasks:      scored.length,
    done_in_time:     doneInTime,
    done_but_delayed: doneButDelayed,
    tasks_overdue:    tasksOverdue,
    tasks_due:        tasksDue,
    not_yet_due:      notYetDue,
    tasks_on_hold:    tasksOnHold,
    fms_score:        fmsScore,
    fms_status:       fmsStatus,
  };
}

// Re-scores a saved document's checklist and persists the computed fields.
// Call this any time checklist_tasks (or anything date-related) changes.
async function rescoreAndSave(id) {
  const doc = await HiringRequisition.findById(id);
  if (!doc) return null;

  const scored = scoreChecklistTasks(doc.checklist_tasks, doc.hiring_status, !!doc.hr_approved_at);
  doc.checklist_tasks  = scored.checklist_tasks;
  doc.total_tasks      = scored.total_tasks;
  doc.done_in_time     = scored.done_in_time;
  doc.done_but_delayed = scored.done_but_delayed;
  doc.tasks_overdue    = scored.tasks_overdue;
  doc.tasks_due        = scored.tasks_due;
  doc.not_yet_due      = scored.not_yet_due;
  doc.tasks_on_hold     = scored.tasks_on_hold;
  doc.fms_score        = scored.fms_score;

  // fmsStatus closes either because every checklist task is done, OR
  // because hiring_status itself represents an end state — see
  // HIRING_STATUS_FORCES_CLOSED above. The override always wins over the
  // checklist-based computation.
  const newFmsStatus = HIRING_STATUS_FORCES_CLOSED.has(doc.hiring_status)
    ? 'Closed'
    : scored.fms_status;

  // closed_at stamps the moment this specific closure happened — only set
  // on the transition into Closed, never touched again while it stays
  // Closed, and cleared if it later reopens (e.g. hiring_status moves off
  // an end state) so a future re-close gets its own fresh timestamp
  // instead of keeping a stale one from a prior episode.
  if (newFmsStatus === 'Closed') {
    if (doc.fmsStatus !== 'Closed') doc.closed_at = new Date();
  } else {
    doc.closed_at = null;
  }
  doc.fmsStatus = newFmsStatus;

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

// Which of the requisition's 4 planned-milestone fields each checklist
// task's own plan date should derive from — mirrors the old Apps
// Script's four checklist groups exactly (Shortlisting Checklist,
// Interviews Checklist, Offer Checklist, General Feedback), just
// flattened into this one 12-item list instead of nested groups. This
// connection never existed in the Node rewrite at all — every task was
// seeded with plan: null regardless of what the requisition's own
// planned dates said, which meant nothing could ever become Overdue (or
// score negative) no matter how much time passed.
const TASK_PLAN_SOURCE = {
  'Role n JD Checked':                   'plan_start_sharing_cvs',
  'Checked Internally for Candidates':   'plan_start_sharing_cvs',
  'Emailed Internally For References':   'plan_start_sharing_cvs',
  'Emailed Others For Reference':        'plan_start_sharing_cvs',
  'Thanked All Applicants':              'plan_start_sharing_cvs',
  'Emailed Shortlisted Candidates':      'plan_start_sharing_cvs',
  'All Interviews Logged':               'planned_interviews_started',
  'Asked Interviewers To Use Role Doc':  'planned_interviews_started',
  'Asked Interviewers to Use Tests':     'planned_interviews_started',
  'Asked Interviewers To Hire Only Best': 'planned_interviews_started',
  'Asked Confirmation in 2 Days':        'planned_offer_accepted',
  'Kept All in Cc':                      'planned_joined',
};

// milestones is the requisition's own { plan_start_sharing_cvs,
// planned_interviews_started, planned_offer_accepted, planned_joined }
// — each task's plan date is looked up from whichever of those four
// fields TASK_PLAN_SOURCE says it belongs to. Falls back to null if a
// milestone was never set on the requisition (matching the previous
// behavior for that one field only, rather than silently defaulting to
// some other date).
function seedChecklistTasks(milestones = {}) {
  return HR_CHECKLIST_TASK_NAMES.map((task) => ({
    task,
    plan: milestones[TASK_PLAN_SOURCE[task]] || null,
    done: null,
    score: null,
    status: '',
    daysLeft: null,
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
      const scored = scoreChecklistTasks(freshTasks, doc.hiring_status, !!doc.hr_approved_at);

      doc.checklist_tasks  = scored.checklist_tasks;
      doc.total_tasks      = scored.total_tasks;
      doc.done_in_time     = scored.done_in_time;
      doc.done_but_delayed = scored.done_but_delayed;
      doc.tasks_overdue    = scored.tasks_overdue;
      doc.tasks_due        = scored.tasks_due;
      doc.not_yet_due      = scored.not_yet_due;
      doc.tasks_on_hold     = scored.tasks_on_hold;
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
      const scored = scoreChecklistTasks(seedChecklistTasks({
        plan_start_sharing_cvs:     doc.plan_start_sharing_cvs,
        planned_interviews_started: doc.planned_interviews_started,
        planned_offer_accepted:     doc.planned_offer_accepted,
        planned_joined:             doc.planned_joined,
      }), doc.hiring_status, true); // legacy records predate the approval gate — treat as already approved rather than retroactively blocking scoring on records already mid-process
      doc.checklist_tasks  = scored.checklist_tasks;
      doc.total_tasks      = scored.total_tasks;
      doc.done_in_time     = scored.done_in_time;
      doc.done_but_delayed = scored.done_but_delayed;
      doc.tasks_overdue    = scored.tasks_overdue;
      doc.tasks_due        = scored.tasks_due;
      doc.not_yet_due      = scored.not_yet_due;
      doc.tasks_on_hold     = scored.tasks_on_hold;
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
      .select(
        'serial_no designation hiring_dept candidate_experience_level role_link jd_link createdAt ' +
        'required_skills role_category remote_eligible base_location screeningQuestions'
      )
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch open positions' });
  }
});

// GET /api/hiringrequisitions/analytics/days-to-hire — average calendar
// days between a requisition being raised and closed: overall, and split
// by candidate_experience_level (Fresher / Experienced).
//
// "Raised" uses request_date (the real as-filed date, parsed with the same
// parseSheetDate used elsewhere in this file) rather than createdAt —
// every requisition imported from the legacy sheet has createdAt stamped
// at migration time, not when it was actually raised, so createdAt alone
// is wrong for almost the entire dataset. Falls back to createdAt only
// when request_date is missing/unparseable (true for genuinely new
// requisitions created directly in this app, where createdAt IS the real
// raise moment).
//
// "Closed" prefers closed_at (real and reliable going forward — see
// rescoreAndSave above). Every requisition that was already Closed before
// closed_at existed has no way to get one retroactively (it only stamps on
// a fresh Open->Closed transition), so for those this falls back to
// hiring_history: imported notes are written as literal
// "MMM D YYYY - <event>" text carrying the real historical date (the
// note's own `date` field is just whenever the bulk import/rescore touched
// the record, not a real event time) — but notes generated live by this
// app's own PATCH /:id route ("Status updated to ...") have no such
// leading date text, and for those the note's `date` field IS the real
// event time. Either way, the latest resolvable event date across a
// requisition's history is the best available stand-in for when it
// actually closed. Requisitions where neither source resolves (or where
// the resolved close date lands before the raise date — inconsistent
// legacy data) are excluded rather than guessed at.
const HISTORY_NOTE_LEADING_DATE = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\b/;
function resolveRaisedDate(doc) {
  return parseSheetDate(doc.request_date) || (doc.createdAt ? new Date(doc.createdAt) : null);
}
function resolveClosedDate(doc) {
  if (doc.closed_at) return new Date(doc.closed_at);
  let latest = null;
  for (const h of doc.hiring_history || []) {
    const note = h.note || '';
    let d = null;
    const m = note.match(HISTORY_NOTE_LEADING_DATE);
    if (m) {
      const parsed = new Date(`${m[1]} ${m[2]}, ${m[3]}`);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else if (/^Status updated to/.test(note) && h.date) {
      d = new Date(h.date);
    }
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

router.get('/analytics/days-to-hire', async (req, res) => {
  try {
    const closed = await HiringRequisition.find({ fmsStatus: 'Closed' })
      .select('candidate_experience_level createdAt request_date closed_at hiring_history')
      .lean();

    const rows = [];
    let excluded = 0;
    for (const doc of closed) {
      const raised = resolveRaisedDate(doc);
      const closedDate = resolveClosedDate(doc);
      const days = raised && closedDate
        ? (closedDate.getTime() - raised.getTime()) / (1000 * 60 * 60 * 24)
        : null;
      if (days == null || days < 0) { excluded++; continue; }
      rows.push({ level: doc.candidate_experience_level, days, closedDate });
    }

    const summarize = (arr) => ({
      avgDays: arr.length ? Math.round((arr.reduce((s, r) => s + r.days, 0) / arr.length) * 10) / 10 : null,
      count: arr.length,
    });

    // Quarterly trend — bucketed by the resolved close date (the same one
    // used for the days-to-hire calculation itself), so a quarter's bar
    // reflects requisitions that actually closed in that quarter.
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const quarters = [1, 2, 3, 4].map((q) => {
      const inQuarter = rows.filter((r) => r.closedDate.getFullYear() === year && Math.floor(r.closedDate.getMonth() / 3) + 1 === q);
      return {
        quarter: `Q${q}`,
        overall: summarize(inQuarter),
        fresher: summarize(inQuarter.filter((r) => r.level === 'Fresher')),
        experienced: summarize(inQuarter.filter((r) => r.level === 'Experienced')),
      };
    });

    const closedYears = rows.map((r) => r.closedDate.getFullYear());
    const minYear = closedYears.length ? Math.min(...closedYears) : year;
    const maxYear = Math.max(new Date().getFullYear(), ...(closedYears.length ? closedYears : [year]));
    const availableYears = [];
    for (let y = maxYear; y >= minYear; y--) availableYears.push(y);

    res.json({
      success: true,
      overall: summarize(rows),
      fresher: summarize(rows.filter((r) => r.level === 'Fresher')),
      experienced: summarize(rows.filter((r) => r.level === 'Experienced')),
      excludedCount: excluded,
      year,
      quarters,
      availableYears,
    });
  } catch (err) {
    console.error('[hiringrequisitions] days-to-hire analytics error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to compute days-to-hire analytics' });
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

// GET /api/hiringrequisitions/:id/referral-info — public, unauthenticated.
// Feeds the /refer/:requisitionId public form with just what it needs,
// with jd_link/role_link resolved via the same Dept/Designation Master
// fallback as the referral-invite email (resolveJdAndRoleLinks) — so a
// requisition raised without its own JD/role doc attached still shows
// whatever's on file for that designation, same as the email does.
router.get('/:id/referral-info', async (req, res) => {
  try {
    const doc = await HiringRequisition.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });

    const { jd_link, role_link } = await resolveJdAndRoleLinks(doc);

    res.json({
      success: true,
      data: {
        _id: doc._id,
        designation: doc.designation,
        hiring_dept: doc.hiring_dept,
        fmsStatus: doc.fmsStatus,
        jd_link,
        role_link,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch referral info' });
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
    //
    // No milestones are passed in here at all — a brand-new requisition
    // is never approved yet, so scoreChecklistTasks below overrides
    // every task's plan to null regardless (see the isApproved-false
    // branch). Real plan dates only get derived once HR actually
    // approves it, via PATCH /:id/approve, using the approval-date-
    // shifted milestones rather than these raw as-filed ones.
    const seedTasks = req.body.checklist_tasks?.length ? req.body.checklist_tasks : seedChecklistTasks();
    const scored = scoreChecklistTasks(seedTasks, req.body.hiring_status, false);

    const fmsStatus = HIRING_STATUS_FORCES_CLOSED.has(req.body.hiring_status)
      ? 'Closed'
      : scored.fms_status;

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
      tasks_on_hold:    scored.tasks_on_hold,
      fms_score:        scored.fms_score,
      // Comes after the ...req.body spread so it always wins — fmsStatus
      // is never something the frontend gets to set directly. Same
      // hiring_status override as rescoreAndSave, applied here too in
      // case someone picks e.g. "On Hold" or "Cancelled" right at
      // creation time.
      fmsStatus,
      closed_at: fmsStatus === 'Closed' ? new Date() : null,
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
    // fmsStatus is deliberately excluded here too — it's fully computed
    // by scoreChecklistTasks/rescoreAndSave below now (auto-closes once
    // every task is Done/Done (Delayed), mirroring the old Apps Script's
    // behavior), never something a client request gets to set directly.
    const { _id, __v, createdAt, updatedAt, serial_no, fmsStatus, ...updates } = req.body;

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

// PATCH /api/hiringrequisitions/:id/approve — HR's explicit approval
// action. Every checklist task stays gated at "Awaiting Approval" (see
// scoreChecklistTasks's isApproved check) until this happens — meant to
// give HR a genuine window to review a brand-new requisition before the
// clock on checklist deadlines starts ticking against them.
//
// The requisition's own 4 as-filed milestone dates are shifted forward
// by however many calendar days approval actually took, before being
// used to derive the 12 tasks' real plan dates for the first time — so
// HR taking a couple of days to approve doesn't unfairly eat into the
// timeline for work that could only start once approval happened.
router.patch('/:id/approve', async (req, res) => {
  try {
    const doc = await HiringRequisition.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });

    if (doc.hr_approved_at) {
      return res.status(400).json({ success: false, error: 'This requisition has already been approved.' });
    }

    const now = new Date();
    doc.hr_approved_at = now;

    // Calendar-day shift, not a raw millisecond difference — approving
    // a few hours into day 2 counts as a 1-day shift, not a fractional
    // one that would throw off every derived plan date by a few hours.
    const requestDate = new Date(doc.request_date);
    requestDate.setHours(0, 0, 0, 0);
    const approvalDate = new Date(now);
    approvalDate.setHours(0, 0, 0, 0);
    const shiftDays = Math.round((approvalDate.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));

    const shiftDate = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      d.setDate(d.getDate() + shiftDays);
      return d;
    };

    doc.checklist_tasks = seedChecklistTasks({
      plan_start_sharing_cvs:     shiftDate(doc.plan_start_sharing_cvs),
      planned_interviews_started: shiftDate(doc.planned_interviews_started),
      planned_offer_accepted:     shiftDate(doc.planned_offer_accepted),
      planned_joined:             shiftDate(doc.planned_joined),
    });

    await doc.save();

    // rescoreAndSave re-fetches fresh and scores against the just-saved
    // hr_approved_at + real plan dates — this is what actually flips
    // every task from "Awaiting Approval" into its real Pending/Overdue/
    // Not Yet Due state in one atomic step.
    const rescored = await rescoreAndSave(doc._id);

    // Fire-and-forget — ask the whole company for referrals now that this
    // role is actually approved and open, not at raw creation time (which
    // would blast the company for requisitions that get killed pre-approval).
    triggerReferralInvite(rescored);

    res.json({ success: true, data: rescored, shiftDays });
  } catch (err) {
    console.error('[hiringrequisitions PATCH /:id/approve]', err);
    res.status(500).json({ success: false, error: 'Failed to approve requisition' });
  }
});

// PATCH /api/hiringrequisitions/:id/status — status-only update (quick action from table)
// fmsStatus is no longer accepted here — it's fully computed from
// checklist completion (see scoreChecklistTasks), never manually set.
// hiring_status remains a genuine manual field: it's a workflow state
// HR chooses (New, Offer Sent, Cancelled, etc.), unrelated to whether
// the FMS checklist itself is complete.
router.patch('/:id/status', async (req, res) => {
  try {
    const { hiring_status } = req.body;
    const updates = {};
    if (hiring_status) updates.hiring_status = hiring_status;

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