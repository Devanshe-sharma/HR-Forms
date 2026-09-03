const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 6 — final escalation once a manager reminder (Mail 5) has already
// gone out and the revision is STILL sitting in 'pending_manager' after an
// even longer threshold (see SALARY_REVISION_FINAL_ESCALATION_DAYS in the
// sender). Goes up a level, to a senior manager / department head — not
// the same reporting manager who's already been reminded once.
function salaryRevisionFinalEscalationTemplate({
  employeeName, department, managerName, dueDate, pendingDays,
}) {
  const subject = `Escalation: Pending Increment Review – ${employeeName} (Overdue)`;

  const html = `
    <p>Dear Senior Manager / Department Head,</p>
    <p>The salary revision recommendation for the following employee remains pending despite a reminder sent to the Reporting Manager.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Employee Details</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Department', department || '-')}
      ${detailRow('Reporting Manager', managerName || '-')}
      ${detailRow('Due Date', dateToDD_MMM_YY(dueDate))}
      ${detailRow('Pending Since', `${pendingDays} day(s)`)}
    </table>

    <p>The pending recommendation is delaying the salary revision process and may impact payroll timelines.</p>
    <p>We request your intervention to facilitate completion of the review at the earliest.</p>
    <p>Thank you for your support.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionFinalEscalationTemplate;
