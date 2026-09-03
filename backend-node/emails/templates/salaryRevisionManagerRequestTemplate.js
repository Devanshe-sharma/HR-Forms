const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');
const actionButton = require('../utils/actionButton');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 1 — sent to the reporting manager the moment a revision enters
// 'pending_manager' (fresh creation, or reopened after Management rejects
// a PIP recommendation). Asks the manager to log their recommendation on
// the dashboard — there's no email-reply mechanism to collect it, same as
// the PDF mockup's own "log in to the Increment Portal" phrasing.
function salaryRevisionManagerRequestTemplate({
  managerName, employeeName, department, designation, joiningDate,
  currentCtc, lastIncrementDate, lastIncrementPct,
  ppoOfferedDate, ppoPreviousCtc, ppoNewCtc,
  fiscalYearLabel, dueDate, actionLink,
}) {
  const subject = `Salary Revision Recommendation – ${employeeName} | ${fiscalYearLabel}`;

  const ppoRows = ppoOfferedDate ? (
    detailRow('PPO Offered On', dateToDD_MMM_YY(ppoOfferedDate))
    + (ppoPreviousCtc != null ? detailRow('PPO Previous CTC (Stipend)', `₹${Number(ppoPreviousCtc).toLocaleString('en-IN')}`) : '')
    + (ppoNewCtc != null ? detailRow('PPO Current CTC', `₹${Number(ppoNewCtc).toLocaleString('en-IN')}`) : '')
  ) : '';

  const html = `
    <p>Dear ${managerName || 'Manager'},</p>
    <p>This is to inform you that as part of the annual salary revision process, kindly review the details of the below employee and provide your recommendation for salary revision.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Department', department || '-')}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Reporting Manager', managerName || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Current CTC', `₹${Number(currentCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('Last Increment Date', lastIncrementDate ? dateToDD_MMM_YY(lastIncrementDate) : 'N/A')}
      ${detailRow('Last Increment %', lastIncrementPct != null ? `${lastIncrementPct}%` : 'N/A')}
      ${ppoRows}
    </table>

    <p>Kindly review the employee's overall performance, contribution, skill development, discipline, ownership, and business impact before submitting your recommendation.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Please provide the following:</p>
    <ul style="margin:4px 0 16px; padding-left:20px;">
      <li>Recommended Increment (%)</li>
      <li>Recommended Revised CTC</li>
      <li>Performance Rating (1-5)</li>
      <li>Recommendation: Strongly Recommend / Recommend / Not Recommended</li>
      <li>Manager's Remarks</li>
    </ul>

    <p>Please use the button below to submit the above.</p>
    ${actionButton(actionLink, 'Submit Recommendation')}

    <p>Kindly submit your recommendation on or before <b>${dateToDD_MMM_YY(dueDate)}</b>.</p>
    <p>Your timely response will enable us to complete the salary revision process within the planned timeline.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionManagerRequestTemplate;
