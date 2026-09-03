const SalaryRevision = require('../models/SalaryRevision');
const {
  MANAGER_WINDOW_DAYS, MANAGEMENT_WINDOW_DAYS, HR_WINDOW_DAYS, addDays,
} = require('./salaryRevisionEscalation');

// FMS-style scoring for a Salary Revision — mirrors the exact scoring
// convention already used by HiringRequisition/Onboarding/Exit (plan vs.
// done date, score = min(0, plan-done) once done, negative-per-day-late
// while overdue), applied to the 3 workflow steps every revision goes
// through: Manager Recommendation -> Management Decision -> Final Closure
// (HR finalisation for an increment, or the PIP outcome for a PIP).
//
// Each step's "plan" date is that step's own window (MANAGER_WINDOW_DAYS /
// MANAGEMENT_WINDOW_DAYS / HR_WINDOW_DAYS) after the previous step's "done"
// date — the same windows Mail 1/5/6 already use, so a step with no
// predecessor done yet has no plan date at all (nothing to judge lateness
// against) and reads as "Not Yet Due", not "Overdue".
function scoreTask(name, planRaw, doneRaw, today) {
  const plan = planRaw ? new Date(planRaw) : null;
  const done = doneRaw ? new Date(doneRaw) : null;
  if (plan) plan.setHours(0, 0, 0, 0);
  if (done) done.setHours(0, 0, 0, 0);

  let score = null, status = '', daysLeft = null;

  if (done) {
    if (plan) {
      const rawDiff = Math.round((plan.getTime() - done.getTime()) / (1000 * 60 * 60 * 24));
      score = Math.min(0, rawDiff);
      status = score < 0 ? 'Done (Delayed)' : 'Done';
    } else {
      score = 0;
      status = 'Done';
    }
  } else if (plan) {
    daysLeft = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      score = daysLeft;
      status = 'Overdue';
    } else {
      status = 'Pending';
    }
  } else {
    status = 'Not Yet Due';
  }

  return { task: name, plan, done, score, status, daysLeft };
}

function scoreSalaryRevision(revision, today = new Date()) {
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);

  const managerPlan = revision.managerRequestedAt ? addDays(revision.managerRequestedAt, MANAGER_WINDOW_DAYS) : null;
  const managerTask = scoreTask('Manager Recommendation', managerPlan, revision.managerDecision?.submittedAt, now);

  const managementPlan = revision.managerDecision?.submittedAt ? addDays(revision.managerDecision.submittedAt, MANAGEMENT_WINDOW_DAYS) : null;
  const managementTask = scoreTask('Management Decision', managementPlan, revision.managementDecision?.submittedAt, now);

  const finalPlan = revision.managementDecision?.submittedAt ? addDays(revision.managementDecision.submittedAt, HR_WINDOW_DAYS) : null;
  const finalDone = revision.hrDecision?.submittedAt || revision.pipOutcomeDate || null;
  const finalTask = scoreTask('Final Closure (HR / PIP Outcome)', finalPlan, finalDone, now);

  const checklistTasks = [managerTask, managementTask, finalTask];

  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0, tasksDue = 0, notYetDue = 0, fmsScore = 0;
  for (const t of checklistTasks) {
    if (t.status === 'Done') doneInTime++;
    else if (t.status === 'Done (Delayed)') doneButDelayed++;
    else if (t.status === 'Overdue') tasksOverdue++;
    else if (t.status === 'Pending') tasksDue++;
    else notYetDue++;
    if (typeof t.score === 'number') fmsScore += t.score;
  }

  return {
    checklistTasks,
    totalTasks: checklistTasks.length,
    doneInTime,
    doneButDelayed,
    tasksOverdue,
    tasksDue,
    notYetDue,
    fmsScore,
    // 'completed' is the only real end state a revision fully closes on —
    // a PIP sitting in 'on_hold' is still an open, tracked commitment
    // until its outcome is recorded (which itself moves the stage to
    // 'completed').
    fmsStatus: revision.stage === 'completed' ? 'Closed' : 'Open',
  };
}

// Recomputes and persists the score on a saved revision — call any time a
// stage transition or decision happens. Accepts either a ready document or
// an id.
async function rescoreSalaryRevision(revisionOrId) {
  const revision = revisionOrId?.save
    ? revisionOrId
    : await SalaryRevision.findById(revisionOrId);
  if (!revision) return null;

  const scored = scoreSalaryRevision(revision);
  revision.checklistTasks = scored.checklistTasks;
  revision.totalTasks     = scored.totalTasks;
  revision.doneInTime     = scored.doneInTime;
  revision.doneButDelayed = scored.doneButDelayed;
  revision.tasksOverdue   = scored.tasksOverdue;
  revision.tasksDue       = scored.tasksDue;
  revision.notYetDue      = scored.notYetDue;
  revision.fmsScore       = scored.fmsScore;
  revision.fmsStatus      = scored.fmsStatus;

  await revision.save();
  return revision;
}

module.exports = { scoreSalaryRevision, rescoreSalaryRevision };
