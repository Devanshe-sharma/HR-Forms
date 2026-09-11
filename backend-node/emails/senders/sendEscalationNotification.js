const sendEmail = require('../sendEmail');
const escalationNotificationTemplate = require('../templates/escalationNotification');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// Fire right after an escalation is created. To: whoever the filer picked
// in the form (default: everyone with the 'Management' role) — no
// hardcoded HR recipient. If the filer clears the list entirely, there's
// no one to send to; the caller's .catch() already handles that quietly.
async function sendEscalationNotification(escalation) {
  const to = (escalation.cc || []).filter(Boolean).join(',');
  if (!to) {
    console.warn(`[sendEscalationNotification] No recipients for ${escalation.caseNumber} — skipping.`);
    return;
  }

  const { subject, html } = escalationNotificationTemplate({
    caseNumber: escalation.caseNumber,
    createdByName: escalation.createdBy.name,
    createdByDepartment: escalation.createdBy.department,
    escalationFor: escalation.escalationFor,
    targetNames: escalation.targetEmployees.map(t => t.name).join(', ') || '-',
    category: escalation.category,
    dateOccurred: escalation.dateOccurred,
    description: escalation.description,
    dashboardLink: `${FRONTEND_URL}/escalations`,
  });

  await sendEmail({ to, subject, html });
}

module.exports = sendEscalationNotification;
