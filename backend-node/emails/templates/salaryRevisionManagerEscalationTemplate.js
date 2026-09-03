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

// Mail 5 — nudge to the manager when a revision is still sitting in
// 'pending_manager' with no managerDecision.submittedAt, N days after the
// original request (see SALARY_REVISION_ESCALATION_DAYS in the sender).
function salaryRevisionManagerEscalationTemplate({
  managerName, employeeName, department, designation, joiningDate, currentCtc, dueDate, actionLink,
}) {
  const subject = `Escalation: Pending Increment Review – ${employeeName}`;

  const html = `
    <p>Dear ${managerName || 'Manager'},</p>
    <p>This is a gentle reminder that your salary revision recommendation for the following employee is still pending.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Department', department || '-')}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Current CTC', `₹${Number(currentCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('Recommendation Due Date', dateToDD_MMM_YY(dueDate))}
    </table>

    <p>Kindly review the employee's performance and submit your recommendation by <b>${dateToDD_MMM_YY(dueDate)}</b>, using the button below, to ensure timely completion of the salary revision process.</p>
    ${actionButton(actionLink, 'Submit Recommendation')}
    <p>If you have already submitted your recommendation, please disregard this email.</p>
    <p>Thank you for your cooperation.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionManagerEscalationTemplate;
