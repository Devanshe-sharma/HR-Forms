const { queueSalaryRevisionMail } = require('../../utils/salaryRevisionMailQueue');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const {
  MANAGER_WINDOW_DAYS, MANAGER_ESCALATION_LEAD_DAYS, ESCALATION_ELIGIBLE_FROM, addDays,
} = require('../../utils/salaryRevisionEscalation');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const salaryRevisionManagerEscalationTemplate = require('../templates/salaryRevisionManagerEscalationTemplate');

// Live as of 2026-09-02 — sends to the real reporting manager, CC'd to HR
// and Management per policy (an escalation is exactly the case both should
// already be aware of, not learn about only if it goes all the way to
// Final Escalation).
const HR_FALLBACK = process.env.HR_EMAIL || 'hr.manager@briskolive.com';
const CC_LIST = [HR_FALLBACK, process.env.EMAIL_MANAGEMENT].filter(Boolean).join(',');

// Mail 5 — daily cron. Queues a draft (does NOT send) once a revision has been
// sitting in 'pending_manager' with no manager decision for
// (MANAGER_WINDOW_DAYS - MANAGER_ESCALATION_LEAD_DAYS) days — i.e. 2 days
// BEFORE the manager's own 10-day deadline, not after it. Only considers
// revisions requested on/after ESCALATION_ELIGIBLE_FROM — anything older
// predates this chain actually being tracked (see salaryRevisionEscalation.js).
async function sendSalaryRevisionManagerEscalation(now = new Date()) {
  const cutoff = addDays(now, -(MANAGER_WINDOW_DAYS - MANAGER_ESCALATION_LEAD_DAYS));

  const overdue = await SalaryRevision.find({
    stage: 'pending_manager',
    'managerDecision.submittedAt': null,
    managerEscalationSentAt: null,
    managerRequestedAt: { $gte: ESCALATION_ELIGIBLE_FROM, $lte: cutoff },
    // Plain Interns never get mail here either — belt-and-suspenders in
    // case a revision like this exists despite the create-time guard
    // (e.g. pre-dates it). "Intern with PPO" is not excluded.
    category: { $ne: 'Intern' },
  });

  for (const revision of overdue) {
    const manager = await resolveManagerContact(revision);
    if (!manager.email) {
      console.error(`[sendSalaryRevisionManagerEscalation] No manager email resolved for revision ${revision._id} (employee: ${revision.employeeName}, reportingHead: ${manager.name || '(none)'}) — falling back to HR.`);
    }
    const to = manager.email || HR_FALLBACK;

    const { subject, html } = salaryRevisionManagerEscalationTemplate({
      managerName: manager.name,
      employeeName: revision.employeeName,
      department: revision.department,
      designation: revision.designation,
      joiningDate: revision.joiningDate,
      currentCtc: revision.previousCtc,
      dueDate: addDays(revision.managerRequestedAt, MANAGER_WINDOW_DAYS),
      actionLink: buildSalaryRevisionActionLink(revision._id, 'manager'),
    });

    await queueSalaryRevisionMail({
      revisionId: revision._id, mailType: 'managerEscalation', employeeName: revision.employeeName,
      to, cc: manager.email ? CC_LIST : '', subject, html,
    });

    // Still set at QUEUE time, not send time — this gate exists so the
    // cron doesn't re-queue the same escalation every day; whether HR has
    // actually sent the draft yet is a separate question the queue's own
    // status field answers.
    revision.managerEscalationSentAt = now;
    await revision.save();
  }

  return { escalatedCount: overdue.length };
}

module.exports = sendSalaryRevisionManagerEscalation;
