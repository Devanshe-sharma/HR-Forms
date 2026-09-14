const sendEmail = require('../sendEmail');
const escalationNotificationTemplate = require('../templates/escalationNotification');
const { CATEGORY_NAMES } = require('../../models/Escalation');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// TEMP kill switch — sending is off for now (asked to hold off on 2026-09-11,
// asked again on 2026-09-14 to hold until the recipient list is confirmed).
// Flip to true (or delete this guard) to actually dispatch mail again.
const SEND_ENABLED = false;

// The Management group always gets every escalation — hardcoded here, not
// dependent on any department/role lookup. Override via env if the roster
// changes without needing a code deploy.
const MANAGEMENT_GROUP_EMAILS = (process.env.ESCALATION_MANAGEMENT_EMAILS ||
  'archana.prem@briskolive.com,amitmathur@briskolive.com,sunil.prem@briskolive.com')
  .split(',').map(s => s.trim()).filter(Boolean);

// Every escalation mail is quietly Bcc'd here too — same address on every
// send, never shown to the To/Cc recipients.
const BCC_EMAIL = process.env.ESCALATION_BCC_EMAIL || 'software.developer@briskolive.com';

// Fire right after an escalation is created (or edited).
// To:  the employee(s) the escalation concerns (falls back to the
//      Management group when there's no named employee, e.g. BO mode).
// Cc:  the hardcoded Management group, plus whoever the filer
//      additionally picked in the form — minus anyone already in To.
// Bcc: BCC_EMAIL, the same address on every single mail, always.
function buildRecipients(escalation) {
  const targetEmails = escalation.targetEmployees.map(t => t.email).filter(Boolean);
  const extra = (escalation.cc || []).filter(Boolean);

  const to = targetEmails.length ? Array.from(new Set(targetEmails)) : [...MANAGEMENT_GROUP_EMAILS];
  const toSet = new Set(to.map(e => e.toLowerCase()));
  const cc = Array.from(new Set([...MANAGEMENT_GROUP_EMAILS, ...extra]))
    .filter(e => !toSet.has(e.toLowerCase()));

  return { to: to.join(','), cc: cc.join(','), bcc: BCC_EMAIL };
}

async function sendEscalationNotification(escalation) {
  const { to, cc, bcc } = buildRecipients(escalation);

  const { subject, html } = escalationNotificationTemplate({
    caseNumber: escalation.caseNumber,
    createdByName: escalation.createdBy.name,
    createdByDepartment: escalation.createdBy.department,
    escalationFor: escalation.escalationFor,
    targetNames: escalation.targetEmployees.map(t => t.name).join(', ') || '-',
    category: `${escalation.category} — ${CATEGORY_NAMES[escalation.category] || escalation.category}`,
    dateOccurred: escalation.dateOccurred,
    description: escalation.description,
    dashboardLink: `${FRONTEND_URL}/escalations`,
  });

  if (!SEND_ENABLED) {
    console.log(`[sendEscalationNotification] Sending disabled — would have emailed ${escalation.caseNumber} — to: ${to} | cc: ${cc || '(none)'} | bcc: ${bcc}`);
    return;
  }

  await sendEmail({ to, cc: cc || undefined, bcc, subject, html });
}

module.exports = sendEscalationNotification;
module.exports.buildRecipients = buildRecipients;
