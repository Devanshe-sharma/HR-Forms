// One-off migration: recompute PRE-EXIT TASKS' planDate for already-approved
// Exit records using resignationDate (the fix in routes/exit.js's
// assignExitPlanDates) instead of the old approvalDate-based calculation,
// then re-score every checklist item so status/score/daysLeft reflect the
// corrected plan dates. EXIT-DAY/POST-EXIT dates are untouched — their
// calculation didn't change.
require('dotenv').config();

const mongoose = require('mongoose');
const Exit = require('../models/exitModel');

// Same scoring logic as routes/exit.js's scoreChecklist — duplicated here
// since that file only exports the router, not its helpers.
function scoreChecklist(list, today) {
  for (const item of list.itemsList) {
    const planDate = item.planDate instanceof Date ? item.planDate : null;
    const doneDate = item.doneDate instanceof Date ? item.doneDate : null;

    if (planDate && !isNaN(planDate.getTime())) {
      const daysDiff = Math.round((planDate.getTime() - today.getTime()) / 86_400_000);
      if (doneDate && !isNaN(doneDate.getTime())) {
        const score = Math.round((planDate.getTime() - doneDate.getTime()) / 86_400_000);
        item.score = score;
        item.daysLeft = null;
        item.status = score < 0 ? 'DONE (DELAYED)' : 'DONE';
      } else if (daysDiff < 0) {
        item.score = daysDiff; item.status = 'OVERDUE'; item.daysLeft = daysDiff;
      } else {
        item.score = 0; item.status = 'PENDING'; item.daysLeft = daysDiff;
      }
    } else if (doneDate) {
      item.score = 0; item.status = 'DONE'; item.daysLeft = null;
    } else {
      item.score = 0; item.status = 'NOT YET DUE'; item.daysLeft = null;
    }
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const docs = await Exit.find({ hr_approved_at: { $ne: null }, resignationDate: { $ne: null } });
  const today = new Date();

  let fixed = 0, skippedAlreadyCorrect = 0;

  for (const doc of docs) {
    const preExit = doc.checkLists.find((l) => l.name === 'PRE-EXIT TASKS');
    if (!preExit) continue;

    let correctPlanDate = new Date(doc.resignationDate);
    correctPlanDate.setDate(correctPlanDate.getDate() + 5);

    // Clamp: pre-exit can never land after the exit day itself — a
    // short/zero notice period would otherwise push this past leftDate.
    const exitDayBase = doc.leftDate || doc.plannedExitDate;
    if (exitDayBase && correctPlanDate.getTime() > new Date(exitDayBase).getTime()) {
      correctPlanDate = new Date(exitDayBase);
    }

    const currentPlanDate = preExit.planDate;
    const alreadyCorrect = currentPlanDate &&
      new Date(currentPlanDate).toDateString() === correctPlanDate.toDateString();

    if (alreadyCorrect) {
      skippedAlreadyCorrect++;
      continue;
    }

    preExit.planDate = correctPlanDate;
    for (const item of preExit.itemsList) item.planDate = correctPlanDate;
    scoreChecklist(preExit, today);

    await doc.save();
    fixed++;
    console.log(`[fixed] ${doc.name || doc._id} — PRE-EXIT plan: ${currentPlanDate} -> ${correctPlanDate.toDateString()}`);
  }

  console.log('\n── Summary ──');
  console.log(`Approved exits checked: ${docs.length}`);
  console.log(`Fixed:                  ${fixed}`);
  console.log(`Already correct:        ${skippedAlreadyCorrect}`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
