const sendEmail = require('../sendEmail');
const escalationNotificationTemplate = require('../templates/escalationNotification');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// The Management group always gets every escalation — hardcoded here, not
// dependent on any department/role lookup. Override via env if the roster
// changes without needing a code deploy.
const MANAGEMENT_GROUP_EMAILS = (process.env.ESCALATION_MANAGEMENT_EMAILS ||
  'archana.prem@briskolive.com,amitmathur@briskolive.com,sunil.prem@briskolive.com')
  .split(',').map(s => s.trim()).filter(Boolean);

// Fire right after an escalation is created. To: the hardcoded Management
// group, plus whoever the filer additionally picked in the form.
async function sendEscalationNotification(escalation) {
  const extra = (escalation.cc || []).filter(Boolean);
  const to = Array.from(new Set([...MANAGEMENT_GROUP_EMAILS, ...extra])).join(',');

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
