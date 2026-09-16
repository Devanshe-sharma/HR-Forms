const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');
const actionButton = require('../utils/actionButton');
const { expectedConfirmationDate, STATUS_LABEL } = require('../../utils/confirmationDueDate');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 2a — fires MANAGEMENT_REMINDER_DAYS after Mail 2 if Management
// still hasn't submitted a decision.
function confirmationManagementReminderTemplate({
  employeeName, designation, department, joiningDate, managerRecommendation, pendingDays, actionLink,
}) {
  const subject = `Reminder: Probation Confirmation Decision Pending – ${employeeName}`;
  const confirmationDate = expectedConfirmationDate(joiningDate);
  const recLabel = STATUS_LABEL[managerRecommendation] || managerRecommendation || '-';

  const html = `
    <p>Dear Management,</p>
    <p>This is a reminder that the probation confirmation decision for <b>${employeeName}</b> is still pending your review.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Department', department || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Probation End Date', dateToDD_MMM_YY(confirmationDate))}
      ${detailRow('Manager Recommendation', recLabel)}
      ${detailRow('Pending Since', `${pendingDays} day(s)`)}
    </table>

    <p>Kindly review and update your decision at the earliest so that HR can proceed with the confirmation process without delay.</p>
    ${actionButton(actionLink, 'Submit Decision')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = confirmationManagementReminderTemplate;
