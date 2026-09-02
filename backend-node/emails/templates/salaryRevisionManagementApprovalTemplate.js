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

// Mail 2 — sent to Management the moment the manager's decision is
// submitted (stage -> 'pending_management'). Recommendation is either an
// increment % or a PIP + duration — never both, per managerDecision's
// schema (decision: 'increment' | 'pip').
function salaryRevisionManagementApprovalTemplate({
  employeeName, department, designation, joiningDate, currentCtc,
  managerName, managerDecision, actionLink,
}) {
  const isPip = managerDecision?.decision === 'pip';

  const recommendationRows = isPip
    ? detailRow('PIP Duration', managerDecision.pipDurationMonths ? `${managerDecision.pipDurationMonths} month(s)` : '-')
      + detailRow('Proposed Review Date', managerDecision.pipNewDueDate ? dateToDD_MMM_YY(managerDecision.pipNewDueDate) : '-')
    : detailRow('Recommended Increment', managerDecision?.recommendedPct != null ? `${managerDecision.recommendedPct}%` : '-')
      + detailRow('Proposed Revised CTC', managerDecision?.recommendedPct != null
        ? `₹${Math.round(currentCtc * (1 + managerDecision.recommendedPct / 100)).toLocaleString('en-IN')}`
        : '-');

  const subject = `Increment Recommendation Submitted – ${employeeName}`;

  const html = `
    <p>Dear Management,</p>
    <p>The salary revision recommendation for the below employee has been reviewed by the Reporting Manager (${managerName || '-'}) and is submitted for your approval.</p>

    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Employee Name', employeeName)}
      ${detailRow('Department', department || '-')}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Current CTC', `₹${Number(currentCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('Manager Recommendation', isPip ? 'Place on PIP' : 'Increment')}
      ${recommendationRows}
      ${detailRow('Manager Remarks', managerDecision?.reason || '-')}
    </table>

    <p>Kindly review and record your decision using the button below, so HR can proceed.</p>
    ${actionButton(actionLink, 'Review & Decide')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionManagementApprovalTemplate;
