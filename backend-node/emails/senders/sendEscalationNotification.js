const sendEmail = require('../sendEmail');
const escalationNotificationTemplate = require('../templates/escalationNotification');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// TEMP kill switch — sending is off for now (asked to hold off on 2026-09-11).
// Flip to true (or delete this guard) to actually dispatch mail again.
const SEND_ENABLED = false;

// The Management group always gets every escalation — hardcoded here, not
// dependent on any department/role lookup. Override via env if the roster
// changes without needing a code deploy.
const MANAGEMENT_GROUP_EMAILS = (process.env.ESCALATION_MANAGEMENT_EMAILS ||
  'archana.prem@briskolive.com,amitmathur@briskolive.com,sunil.prem@briskolive.com')
  .split(',').map(s => s.trim()).filter(Boolean);

// Fire right after an escalation is created (or edited). To: the hardcoded
// Management group, the employee(s) it concerns, plus whoever the filer
// additionally picked in the form.
async function sendEscalationNotification(escalation) {
  const targetEmails = escalation.targetEmployees.map(t => t.email).filter(Boolean);
  const extra = (escalation.cc || []).filter(Boolean);
  const to = Array.from(new Set([...MANAGEMENT_GROUP_EMAILS, ...targetEmails, ...extra])).join(',');

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

  if (!SEND_ENABLED) {
    console.log(`[sendEscalationNotification] Sending disabled — would have emailed ${escalation.caseNumber} to: ${to}`);
    return;
  }

  await sendEmail({ to, subject, html });
}

module.exports = sendEscalationNotification;
