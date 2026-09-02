const sendEmail = require('../sendEmail');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { MANAGER_ESCALATION_DAYS, RESPONSE_DAYS, addDays } = require('../../utils/salaryRevisionEscalation');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const salaryRevisionManagerEscalationTemplate = require('../templates/salaryRevisionManagerEscalationTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to reporting managers (with HR cc'd) is approved.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 5 — daily cron. Finds every revision still 'pending_manager' with
// no manager decision, past MANAGER_ESCALATION_DAYS since it was raised,
// and not yet escalated once (managerEscalationSentAt gate).
async function sendSalaryRevisionManagerEscalation(now = new Date()) {
  const cutoff = addDays(now, -MANAGER_ESCALATION_DAYS);

  const overdue = await SalaryRevision.find({
    stage: 'pending_manager',
    'managerDecision.submittedAt': null,
    managerEscalationSentAt: null,
    managerRequestedAt: { $lte: cutoff },
  });

  for (const revision of overdue) {
    const manager = await resolveManagerContact(revision);

    const { subject, html } = salaryRevisionManagerEscalationTemplate({
      managerName: manager.name,
      employeeName: revision.employeeName,
      department: revision.department,
      designation: revision.designation,
      currentCtc: revision.previousCtc,
      dueDate: addDays(revision.managerRequestedAt, RESPONSE_DAYS),
      actionLink: buildSalaryRevisionActionLink(revision._id, 'manager'),
    });

    await sendEmail({ to: RECIPIENT, subject, html });

    revision.managerEscalationSentAt = now;
    await revision.save();
  }

  return { escalatedCount: overdue.length };
}

module.exports = sendSalaryRevisionManagerEscalation;
