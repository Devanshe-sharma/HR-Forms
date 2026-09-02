const sendEmail = require('../sendEmail');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { FINAL_ESCALATION_DAYS, RESPONSE_DAYS, addDays } = require('../../utils/salaryRevisionEscalation');
const salaryRevisionFinalEscalationTemplate = require('../templates/salaryRevisionFinalEscalationTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to a senior manager/department head is approved.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 6 — daily cron. Finds every revision still 'pending_manager' with
// no manager decision, past FINAL_ESCALATION_DAYS since it was raised, and
// not yet finally escalated (finalEscalationSentAt gate). Independent of
// whether Mail 5 already fired for it.
async function sendSalaryRevisionFinalEscalation(now = new Date()) {
  const cutoff = addDays(now, -FINAL_ESCALATION_DAYS);

  const overdue = await SalaryRevision.find({
    stage: 'pending_manager',
    'managerDecision.submittedAt': null,
    finalEscalationSentAt: null,
    managerRequestedAt: { $lte: cutoff },
  });

  for (const revision of overdue) {
    const manager = await resolveManagerContact(revision);
    const dueDate = addDays(revision.managerRequestedAt, RESPONSE_DAYS);
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
