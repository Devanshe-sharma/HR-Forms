require('dotenv').config();
const mongoose = require('mongoose');
const Exit = require('./models/exitModel');

// Follow-up to backfillApproveExits.js — that script already ran once
// and approved everything, but their checkLists[].planDate values were
// computed under the OLD resignation/left-date-based logic. This
// re-applies the NEW simplified logic (approvalDate + 5/15 days,
// unconditionally) to every record that's already approved, so their
// plan dates and scoring actually reflect the current rules instead of
// whatever was computed before this change.
//
// No emails, no changes to hr_approved_at itself — only checkLists and
// the derived aggregate fields get recalculated.

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

async function rescoreApprovedExits() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const docs = await Exit.find({ hr_approved_at: { $ne: null } });
  console.log(`Found ${docs.length} already-approved exit(s) to re-score.\n`);

  let updated = 0;

  for (const doc of docs) {
    const checkLists = doc.toObject().checkLists || [];
    if (checkLists.length === 0) continue; // nothing to score

    assignExitPlanDates(checkLists, doc.hr_approved_at, doc.leftDate, doc.plannedExitDate);

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
    console.log(`✅ Re-scored "${doc.name}" (approved: ${new Date(doc.hr_approved_at).toISOString().slice(0, 10)})`);
    updated++;
  }

  console.log(`\nDone. Re-scored ${updated} record(s). No emails were sent.`);
  await mongoose.disconnect();
}

rescoreApprovedExits().catch((err) => {
  console.error('Re-score failed:', err);
  process.exit(1);
});