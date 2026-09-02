const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 4 — sent to the employee when Management approves a PIP (stage ->
// 'on_hold'). reviewDate is revision.reviewDate, set from the manager's
// pipNewDueDate at submission time.
function salaryRevisionPipHoldTemplate({
  employeeName, department, designation, joiningDate, currentCtc,
  pipStartDate, pipReviewDate,
}) {
  const subject = 'Increment Review Status Update';

  const html = `
    <p>Dear ${employeeName},</p>
    <p>We hope you are doing well.</p>
    <p>As part of the Company's annual salary review process, your performance and overall contribution were evaluated in line with the established appraisal criteria.</p>
    <p>Based on the review, it has been decided that your salary revision will <b>remain on hold</b> at this time while you continue under the Performance Improvement Plan (PIP).</p>

    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Department', department || '-')}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Current CTC', `₹${Number(currentCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('PIP Start Date', dateToDD_MMM_YY(pipStartDate))}
      ${detailRow('PIP Review Date', dateToDD_MMM_YY(pipReviewDate))}
    </table>

    <p>The objective of the PIP is to provide structured support and clearly defined performance expectations to help you achieve the required standards for your role.</p>
    <p>Your performance will be reviewed on <b>${dateToDD_MMM_YY(pipReviewDate)}</b>. Subject to successful completion of the PIP and sustained improvement, your salary revision may be reconsidered in accordance with the Company's salary review process and business requirements.</p>
    <p>We encourage you to work closely with your Reporting Manager and HR throughout this period. We are committed to supporting your development and helping you succeed.</p>
    <p>Should you have any questions, please feel free to reach out to the HR Department.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionPipHoldTemplate;
