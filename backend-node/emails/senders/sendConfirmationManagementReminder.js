const { queueConfirmationMail } = require('../../utils/confirmationMailQueue');
const Confirmations = require('../../models/Confirmations');
const { MANAGEMENT_REMINDER_DAYS, addDays } = require('../../utils/confirmationEscalation');
const { buildConfirmationActionLink } = require('../../utils/confirmationMailSigning');
const confirmationManagementReminderTemplate = require('../templates/confirmationManagementReminderTemplate');

const RECIPIENT = process.env.EMAIL_MANAGEMENT;

// Mail 2a — daily cron. Queues a draft (does NOT send) once
// MANAGEMENT_REMINDER_DAYS have passed since Mail 2 with still no
// management decision, and not yet reminded (managementReminderSentAt
// gate — one-shot). managementRequestedAt is null forever on any record
// that predates this mail system, so this can never match a legacy
// pending_management record.
async function sendConfirmationManagementReminder(now = new Date()) {
  const cutoff = addDays(now, -MANAGEMENT_REMINDER_DAYS);

  const overdue = await Confirmations.find({
    stage: 'pending_management',
    'managementDecision.submittedAt': null,
    managementReminderSentAt: null,
    managementRequestedAt: { $ne: null, $lte: cutoff },
  });

  for (const record of overdue) {
    const pendingDays = Math.floor((now.getTime() - record.managementRequestedAt.getTime()) / (1000 * 60 * 60 * 24));

    const { subject, html } = confirmationManagementReminderTemplate({
      employeeName: record.employeeName,
      designation: record.designation,
      department: record.department,
      joiningDate: record.joiningDate,
      managerRecommendation: record.managerDecision?.status,
      pendingDays,
      actionLink: buildConfirmationActionLink(record._id, 'management'),
    });

    await queueConfirmationMail({
      confirmationId: record._id, mailType: 'managementReminder', employeeName: record.employeeName,
      to: RECIPIENT, subject, html,
    });

    record.managementReminderSentAt = now;
    await record.save();
  }

  return { remindedCount: overdue.length };
}

module.exports = sendConfirmationManagementReminder;
