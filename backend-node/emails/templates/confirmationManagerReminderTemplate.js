const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');
const actionButton = require('../utils/actionButton');
const { expectedConfirmationDate } = require('../../utils/confirmationDueDate');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 1a — fires MANAGER_REMINDER_DAYS after Mail 1 if the manager still
// hasn't submitted a recommendation.
function confirmationManagerReminderTemplate({
  managerName, employeeName, designation, department, joiningDate, pendingDays, actionLink,
}) {
  const subject = `Reminder: Probation Confirmation Review Pending – ${employeeName}`;
  const confirmationDate = expectedConfirmationDate(joiningDate);

  const html = `
    <p>Dear ${managerName || 'Manager'},</p>
    <p>This is a reminder that the probation confirmation review for <b>${employeeName}</b> is still pending your recommendation.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Department', department || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Confirmation Date', dateToDD_MMM_YY(confirmationDate))}
      ${detailRow('Pending Since', `${pendingDays} day(s)`)}
    </table>

    <p>Kindly share your feedback/recommendation at the earliest so that HR can proceed with the confirmation process without delay.</p>
    ${actionButton(actionLink, 'Submit Recommendation')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = confirmationManagerReminderTemplate;
