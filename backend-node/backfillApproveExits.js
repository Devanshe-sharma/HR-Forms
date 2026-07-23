require('dotenv').config();
const mongoose = require('mongoose');
const Exit = require('./models/exitModel');

// One-time backfill: every EXISTING Exit record that has a
// resignationDate but is still unapproved gets approved retroactively,
// using resignationDate + 3 days as the approval date — matching HR's
// own 3-day approval target, applied retroactively as if it had been
// hit exactly on time.
//
// TWO NAMED PEOPLE get an explicit override instead of the +3-day rule:
// Vanshika -> 29 June 2026, Richa Srivastava -> 11 July 2026. Matched
// by name (case-insensitive substring, so "Vanshika Sharma" etc. still
// gets caught).
//
// Does NOT re-seed checkLists or touch any existing plan/done dates —
// only sets hr_approved_at and re-scores using whatever already exists,
// same principle as backfillApproveExisting.js for Requisitions.
//
// ASSUMPTION: no emails fire from this — never imports emails/index.js
// or triggerUpdateExit. Tell me if you actually wanted those to go out.

const NAME_OVERRIDE_DATES = [
  { match: 'vanshika', date: '2026-06-29' },
  { match: 'richa srivastava', date: '2026-07-11' },
];

function getOverrideDate(name) {
  const n = (name || '').trim().toLowerCase();
  const found = NAME_OVERRIDE_DATES.find((o) => n.includes(o.match));
  return found ? new Date(found.date) : null;
}

// ─── Scoring logic, copied from routes/exit.js's scoreChecklist ───────────
function scoreChecklist(list, today) {
  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
      tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

  for (const item of list.itemsList) {
    const planDate = item.planDate instanceof Date ? item.planDate : null;
    const doneDate = item.doneDate instanceof Date ? item.doneDate : null;

    if (planDate && !isNaN(planDate.getTime())) {
      const daysDiff = Math.round((planDate.getTime() - today.getTime()) / 86_400_000);

      if (doneDate && !isNaN(doneDate.getTime())) {
        const score = Math.round((planDate.getTime() - doneDate.getTime()) / 86_400_000);
        item.score = score;
        item.daysLeft = null;
        if (score < 0) { item.status = "DONE (DELAYED)"; doneButDelayed++; fmsScore += score; }
        else { item.status = "DONE"; doneInTime++; }
      } else {
        if (daysDiff < 0) {
          item.score = daysDiff; item.status = "OVERDUE"; item.daysLeft = daysDiff;
          tasksOverdue++; fmsScore += daysDiff; tasksNotDone++;
        } else {
          item.score = 0; item.status = "PENDING"; item.daysLeft = daysDiff;
          tasksDue++; tasksNotDone++;
        }
      }
    } else {
      if (doneDate) {
        item.score = 0; item.status = "DONE"; item.daysLeft = null; doneInTime++;
      } else {
        item.score = 0; item.status = "NOT YET DUE"; item.daysLeft = null;
        notYetDue++; tasksNotDone++;
      }
    }
  }

  return { doneInTime, doneButDelayed, tasksOverdue, tasksDue, notYetDue, fmsScore, tasksNotDone };
}

// ─── assignExitPlanDates, matching the hybrid version now in
// routes/exit.js — PRE-EXIT from approvalDate, EXIT-DAY/POST-EXIT from
// leftDate (or plannedExitDate fallback) ───────────────────────────────────
function assignExitPlanDates(checkLists, approvalDate, leftDate, plannedExitDate) {
  for (const list of checkLists) {
    let base, offsetDays;

    if (list.name === "PRE-EXIT TASKS") {
      base = approvalDate ? new Date(approvalDate) : null;
      offsetDays = 5;
    } else if (list.name === "EXIT-DAY TASKS") {
      base = (leftDate || plannedExitDate) ? new Date(leftDate || plannedExitDate) : null;
      offsetDays = 0;
    } else {
      base = (leftDate || plannedExitDate) ? new Date(leftDate || plannedExitDate) : null;
      offsetDays = 5;
    }

    if (base && !isNaN(base.getTime())) {
      const planDate = new Date(base);
      planDate.setDate(planDate.getDate() + offsetDays);
      list.planDate = planDate;
      for (const item of list.itemsList) item.planDate = planDate;
    }
  }
}

function deriveFmsStatus(exitStatus, tasksNotDone) {
  if (["Left", "Not Exiting", "Exit Cancelled"].includes(exitStatus)) return "Closed";
  return tasksNotDone === 0 ? "Closed" : "Open";
}

async function backfillApproveExits() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const docs = await Exit.find({
    hr_approved_at: null,
    resignationDate: { $ne: null },
  });
  console.log(`Found ${docs.length} unapproved exit(s) with a resignation date.\n`);

  let approved = 0, overridden = 0;

  for (const doc of docs) {
    const overrideDate = getOverrideDate(doc.name);

    let approvalDate;
    if (overrideDate) {
      approvalDate = overrideDate;
      overridden++;
    } else {
      approvalDate = new Date(doc.resignationDate);
      approvalDate.setDate(approvalDate.getDate() + 3);
    }
    doc.hr_approved_at = approvalDate;

    const checkLists = doc.toObject().checkLists || [];
    assignExitPlanDates(checkLists, approvalDate, doc.leftDate, doc.plannedExitDate);

    const today = new Date();
    let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
        tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

    for (const list of checkLists) {
      const r = scoreChecklist(list, today);
      doneInTime += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue += r.tasksOverdue;
      tasksDue += r.tasksDue;
      notYetDue += r.notYetDue;
      fmsScore += r.fmsScore;
      tasksNotDone += r.tasksNotDone;
    }

    doc.checkLists = checkLists;
    doc.totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
    doc.doneInTime = doneInTime;
    doc.doneButDelayed = doneButDelayed;
    doc.tasksOverdue = tasksOverdue;
    doc.tasksDue = tasksDue;
    doc.notYetDue = notYetDue;
    doc.fmsScore = fmsScore;
    doc.fmsStatus = deriveFmsStatus(doc.exitStatus, tasksNotDone);

    await doc.save();
    console.log(`✅ Approved "${doc.name}" — approval date set to ${approvalDate.toISOString().slice(0, 10)} (${overrideDate ? 'explicit override' : 'resignation date + 3 days'})`);
    approved++;
  }

  console.log(`\nDone. Approved: ${approved} (${overridden} with explicit override dates). No emails were sent.`);
  await mongoose.disconnect();
}

backfillApproveExits().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});