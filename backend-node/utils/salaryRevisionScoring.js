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

// The whole annual review cycle (Reminder Date -> Due Date) judged as ONE
// thing, separate from the 3 actor-response tasks scored above. Rules,
// exactly as specified:
//   - today < Reminder Date                         -> Not Yet Due (no score)
//   - Reminder Date has arrived, stage not yet at   -> Pending, score 0
//     the HR/closure milestone (pending_manager or
//     pending_management)
//   - stage has reached the HR/closure milestone     -> Due, score 0
//     (pending_hr, or on_hold for the PIP path)
//     — stays Due for as long as it's open, however
//     late that gets; there is deliberately no
//     separate "Overdue" bucket while still open
//   - closed (stage completed) on/before Due Date     -> Done, score 0
//   - closed after Due Date                          -> Done (Delayed),
//     score = -(days late)
// Reminder Date is read from managerRequestedAt, which
// sendSalaryRevisionManagerRequest.js already self-heals to the real
// annual cycle date (get11MonthDate/internReviewDate) — not re-derived
// here, so this always agrees with what Mail 1 actually used.
function scoreOverallCycle(revision, today = new Date()) {
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);

  const reminderDate = revision.managerRequestedAt ? new Date(revision.managerRequestedAt) : null;
  if (reminderDate) reminderDate.setHours(0, 0, 0, 0);
  const dueDate = reminderDate
    ? new Date(reminderDate.getFullYear(), reminderDate.getMonth() + 1, reminderDate.getDate())
    : null;

  // Completed is checked FIRST, independent of whether reminderDate is
  // even known — older/legacy revisions predate managerRequestedAt being
  // tracked at all, and a finished revision is still "done" regardless.
  // Without a Due Date to compare against, there's no way to judge
  // lateness, so it reads as on-time (score 0) rather than delayed.
  if (revision.stage === 'completed') {
    const completedOn = revision.hrDecision?.submittedAt || revision.pipOutcomeDate || null;
    if (!completedOn || !dueDate) return { status: 'done', score: 0, reminderDate, dueDate };
    const done = new Date(completedOn);
    done.setHours(0, 0, 0, 0);
    if (done > dueDate) {
      const lateDays = Math.round((done.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'done_delayed', score: -lateDays, reminderDate, dueDate };
    }
    return { status: 'done', score: 0, reminderDate, dueDate };
  }

  if (!reminderDate) {
    return { status: 'not_yet_due', score: null, reminderDate: null, dueDate: null };
  }

  if (now < reminderDate) {
    return { status: 'not_yet_due', score: null, reminderDate, dueDate };
  }

  const reachedLateStage = revision.stage === 'pending_hr' || revision.stage === 'on_hold';
  return { status: reachedLateStage ? 'due' : 'pending', score: 0, reminderDate, dueDate };
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

  const cycle = scoreOverallCycle(revision, now);

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
    cycleStatus: cycle.status,
    cycleScore: cycle.score,
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
  revision.cycleStatus    = scored.cycleStatus;
  revision.cycleScore     = scored.cycleScore;

  await revision.save();
  return revision;
}

module.exports = { scoreSalaryRevision, rescoreSalaryRevision, scoreOverallCycle };
