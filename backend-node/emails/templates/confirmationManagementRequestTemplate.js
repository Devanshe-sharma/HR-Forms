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

// Mail 2 — fires the moment the reporting manager submits their
// recommendation. Asks Management to review and provide their decision.
function confirmationManagementRequestTemplate({
  employeeName, designation, department, joiningDate, managerRecommendation, actionLink,
}) {
  const subject = `Action Required: Probation Confirmation Decision – ${employeeName}`;
  const confirmationDate = expectedConfirmationDate(joiningDate);
  const recLabel = STATUS_LABEL[managerRecommendation] || managerRecommendation || '-';

  const html = `
    <p>Dear Management,</p>
    <p>This is to inform you that the probation review for <b>${employeeName}</b> has been completed by the Reporting Manager, and the employee has been recommended for: <b>${recLabel}</b>.</p>
    <p>We request you to kindly review the recommendation and provide your decision.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Department', department || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Probation End Date', dateToDD_MMM_YY(confirmationDate))}
      ${detailRow('Manager Recommendation', recLabel)}
    </table>

    <p style="font-weight:bold; margin-bottom:4px;">Management Decision:</p>
    <p>Please select one of the following:</p>
    <ul style="margin:4px 0 16px; padding-left:20px;">
      <li>Approve &ndash; Confirm Employee</li>
      <li>Extend Probation</li>
    </ul>

    <p>Kindly review and update your decision at the earliest so that HR can proceed with the confirmation process.</p>
    ${actionButton(actionLink, 'Submit Decision')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = confirmationManagementRequestTemplate;
