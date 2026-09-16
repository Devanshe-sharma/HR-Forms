const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');
const actionButton = require('../utils/actionButton');
const { STANDARD_PROBATION_MONTHS, expectedConfirmationDate } = require('../../utils/confirmationDueDate');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 1 — fires the moment a confirmation review opens (5 months'
// tenure — 1 month before the standard 6-month confirmation date). Asks
// the reporting manager for their recommendation.
function confirmationManagerRequestTemplate({
  managerName, employeeName, designation, department, joiningDate, actionLink,
}) {
  const subject = `Action Required: Probation Confirmation Review – ${employeeName}`;
  const confirmationDate = expectedConfirmationDate(joiningDate);

  const html = `
    <p>Dear ${managerName || 'Manager'},</p>
    <p>This is to inform you that <b>${employeeName}</b>, working as ${designation || '-'} in the ${department || '-'}, is due for confirmation upon completion of the probation period.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Probation Period', `${STANDARD_PROBATION_MONTHS} Months`)}
      ${detailRow('Confirmation Date', dateToDD_MMM_YY(confirmationDate))}
    </table>

    <p>We request you to kindly review the employee's performance during the probation period and share your feedback/recommendation regarding their confirmation.</p>
    <p>Please provide your feedback by <b>${dateToDD_MMM_YY(confirmationDate)}</b>, so that HR can proceed with the confirmation process accordingly.</p>
    ${actionButton(actionLink, 'Submit Recommendation')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = confirmationManagerRequestTemplate;
