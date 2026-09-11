const formatDateIST = require('../utils/formatDateIST');
const actionButton = require('../utils/actionButton');
const signature = require('../utils/signature');

// Notifies HR (To) and the chosen recipients (Cc, default: Management)
// whenever an escalation is logged — links straight to the dashboard
// rather than embedding the full description, since only HR/Management
// can act on it there and the mail is a heads-up, not the record itself.
function escalationNotificationTemplate({
  caseNumber, createdByName, createdByDepartment, escalationFor,
  targetNames, category, dateOccurred, description, dashboardLink,
}) {
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#64748b; font-family:Arial,sans-serif; white-space:nowrap;">${label}</td>
      <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#0f172a; font-family:Arial,sans-serif; font-weight:bold;">${value}</td>
    </tr>`;

  const html = `
    <p style="font-family:Arial,sans-serif; font-size:14px; color:#0f172a;">Dear Team,</p>
    <p style="font-family:Arial,sans-serif; font-size:14px; color:#0f172a; line-height:1.6;">
      A new escalation has been logged in the HR system and is awaiting review. Details are summarized below.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
      style="max-width:520px; border:1px solid #e2e8f0; border-radius:8px; border-collapse:collapse; margin:18px 0; overflow:hidden;">
      ${row('Case Number', caseNumber)}
      ${row('Raised By', `${createdByName}${createdByDepartment ? ` (${createdByDepartment})` : ''}`)}
      ${row('Escalation Type', escalationFor)}
      ${row('Concerning', targetNames)}
      ${row('Category', category)}
      ${row('Date Occurred', formatDateIST(dateOccurred) || '-')}
    </table>

    <p style="font-family:Arial,sans-serif; font-size:14px; color:#0f172a; line-height:1.6;">
      <b>Description:</b><br>${(description || '').replace(/\n/g, '<br>')}
    </p>

    <p style="font-family:Arial,sans-serif; font-size:14px; color:#0f172a; line-height:1.6;">
      Please review the complete record and take any necessary action from the Escalations dashboard.
    </p>

    ${actionButton(dashboardLink, 'View Escalation Dashboard')}

    <p style="font-family:Arial,sans-serif; font-size:12px; color:#64748b;">
      If the button above does not work, copy and paste this link into your browser: <a href="${dashboardLink}" style="color:#1a3e72;">${dashboardLink}</a>
    </p>

    ${signature()}
  `;

  return {
    subject: `Escalation Logged — ${caseNumber} · ${category}`,
    html,
  };
}

module.exports = escalationNotificationTemplate;
