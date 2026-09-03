const sendEmail = require('../sendEmail');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { FINAL_ESCALATION_DAYS, ESCALATION_ELIGIBLE_FROM, addDays } = require('../../utils/salaryRevisionEscalation');
const salaryRevisionFinalEscalationTemplate = require('../templates/salaryRevisionFinalEscalationTemplate');

// Live as of 2026-09-02 — no dedicated "senior manager/dept head" field
// exists anywhere in the data model, so this goes to the HR Head, who is
// the actual senior escalation contact used elsewhere in this codebase
// (see sendWeeklyExitSummary.js).
const RECIPIENT = process.env.HR_HEAD_EMAIL || 'hr.head@briskolive.com';

// Mail 6 — daily cron. Fires once the manager's own window has fully
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

    await sendEmail({ to: RECIPIENT, subject, html });

    revision.finalEscalationSentAt = now;
    await revision.save();
  }

  return { escalatedCount: overdue.length };
}

module.exports = sendSalaryRevisionFinalEscalation;
