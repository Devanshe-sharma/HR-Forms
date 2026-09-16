const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { FINAL_ESCALATION_DAYS, ESCALATION_ELIGIBLE_FROM, addDays } = require('../../utils/salaryRevisionEscalation');
const salaryRevisionFinalEscalationTemplate = require('../templates/salaryRevisionFinalEscalationTemplate');

// Changed 2026-09-15 per explicit instruction — goes to Management
// (the actual decision-makers above the reporting manager), not HR Head.
const RECIPIENT = process.env.EMAIL_MANAGEMENT;

// Mail 6 — daily cron. Queues a draft (does NOT send) once the manager's own window has fully
// expired (FINAL_ESCALATION_DAYS, same anchor/value as MANAGER_WINDOW_DAYS)
// with still no decision, and not yet finally escalated
// (finalEscalationSentAt gate). Independent of whether Mail 5 already fired
// for it. Only considers revisions requested on/after
// ESCALATION_ELIGIBLE_FROM — see salaryRevisionEscalation.js.
async function sendSalaryRevisionFinalEscalation(now = new Date()) {
  const cutoff = addDays(now, -FINAL_ESCALATION_DAYS);

  const overdue = await SalaryRevision.find({
    stage: 'pending_manager',
    'managerDecision.submittedAt': null,
    finalEscalationSentAt: null,
    managerRequestedAt: { $gte: ESCALATION_ELIGIBLE_FROM, $lte: cutoff },
    // Plain Interns never get mail here either — belt-and-suspenders in
    // case a revision like this exists despite the create-time guard
    // (e.g. pre-dates it). "Intern with PPO" is not excluded.
    category: { $ne: 'Intern' },
  });

  for (const revision of overdue) {
    const manager = await resolveManagerContact(revision);
    const dueDate = addDays(revision.managerRequestedAt, FINAL_ESCALATION_DAYS);
    const pendingDays = Math.floor((now.getTime() - revision.managerRequestedAt.getTime()) / (1000 * 60 * 60 * 24));

    const { subject, html } = salaryRevisionFinalEscalationTemplate({
      employeeName: revision.employeeName,
      department: revision.department,
      managerName: manager.name,
      dueDate,
      pendingDays,
    });

    await queueSalaryRevisionMail({
      revisionId: revision._id, mailType: 'finalEscalation', employeeName: revision.employeeName,
      to: RECIPIENT, subject, html,
    });

    // Still set at QUEUE time — see sendSalaryRevisionManagerEscalation.js's
    // comment on the same pattern.
    revision.finalEscalationSentAt = now;
    await revision.save();
  }

  return { escalatedCount: overdue.length };
}

module.exports = sendSalaryRevisionFinalEscalation;
