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

// Mail 3 — fires the moment Management submits a final confirmed/
// not_confirmed decision (an 'extended' outcome never reaches here — it
// goes straight to on_hold, nothing for HR to do). Asks HR to upload the
// confirmation/extension letter and close the record out.
function confirmationHrNotifyTemplate({
  employeeName, designation, department, joiningDate, managementDecision, actionLink,
}) {
  const subject = `Action Required: Complete Confirmation Documentation – ${employeeName}`;
  const confirmationDate = expectedConfirmationDate(joiningDate);
  const decisionLabel = STATUS_LABEL[managementDecision] || managementDecision || '-';

  const html = `
    <p>Dear HR Team,</p>
    <p>This is to inform you that the probation review for <b>${employeeName}</b> has been completed by the Reporting Manager and Management, and the employee has been <b>${decisionLabel}</b>.</p>
    <p>Kindly proceed with the confirmation process accordingly.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Department', department || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Probation End Date', dateToDD_MMM_YY(confirmationDate))}
      ${detailRow('Confirmation Effective Date', dateToDD_MMM_YY(new Date()))}
      ${detailRow('Management Decision', decisionLabel)}
    </table>

    <p>Please update and complete the necessary documentation accordingly.</p>
    ${actionButton(actionLink, 'Complete Documentation')}
    <p>Thank you.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = confirmationHrNotifyTemplate;
