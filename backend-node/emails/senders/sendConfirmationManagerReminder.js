const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const Confirmations = require('../../models/Confirmations');
const resolveConfirmationManagerContact = require('../../utils/resolveConfirmationManagerContact');
const { MANAGER_REMINDER_DAYS, addDays } = require('../../utils/confirmationEscalation');
const { buildConfirmationActionLink } = require('../../utils/confirmationMailSigning');
const confirmationManagerReminderTemplate = require('../templates/confirmationManagerReminderTemplate');

const HR_FALLBACK = process.env.HR_EMAIL || 'hr.manager@briskolive.com';
const CC_MANAGEMENT = process.env.EMAIL_MANAGEMENT || '';

// Mail 1a — daily cron. Queues a draft (does NOT send) once
// MANAGER_REMINDER_DAYS have passed since Mail 1 with still no manager
// decision, and not yet reminded (managerReminderSentAt gate — one-shot,
// same convention as Salary Revision's escalation chain). managerRequestedAt
// is null forever on any record that predates this mail system, so this
// can never match a legacy pending_manager record.
async function sendConfirmationManagerReminder(now = new Date()) {
  const cutoff = addDays(now, -MANAGER_REMINDER_DAYS);

  const overdue = await Confirmations.find({
    stage: 'pending_manager',
    'managerDecision.submittedAt': null,
    managerReminderSentAt: null,
    managerRequestedAt: { $ne: null, $lte: cutoff },
  });

  for (const record of overdue) {
    const manager = await resolveConfirmationManagerContact(record);
    const to = manager.email || HR_FALLBACK;
    const pendingDays = Math.floor((now.getTime() - record.managerRequestedAt.getTime()) / (1000 * 60 * 60 * 24));

    const { subject, html } = confirmationManagerReminderTemplate({
      managerName: manager.name,
      employeeName: record.employeeName,
      designation: record.designation,
      department: record.department,
      joiningDate: record.joiningDate,
      pendingDays,
      actionLink: buildConfirmationActionLink(record._id, 'manager'),
    });

    await queueConfirmationMail({
      confirmationId: record._id, mailType: 'managerReminder', employeeName: record.employeeName,
      to, cc: manager.email ? CC_MANAGEMENT : '', subject, html,
    });

    // Still set at QUEUE time, not send time — this gate exists so the
    // cron doesn't re-queue the same reminder every day.
    record.managerReminderSentAt = now;
    await record.save();
  }

  return { remindedCount: overdue.length };
}

module.exports = sendConfirmationManagerReminder;
