const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

function detailRow(label, value) {
  return `
    <tr>
      <td style="border:1px solid #e2e8f0; padding:6px 10px; background:#f8fafc; font-weight:bold; width:220px;">${label}</td>
      <td style="border:1px solid #e2e8f0; padding:6px 10px;">${value}</td>
    </tr>`;
}

// Mail 3 — sent to the employee once HR finalises the revision (stage ->
// 'completed', increment path only — a PIP that never gets an increment
// has nothing to confirm here).
function salaryRevisionEmployeeConfirmationTemplate({
  employeeName, department, designation, joiningDate,
  previousCtc, incrementPct, newCtc, effectiveFrom,
}) {
  const subject = 'Salary Revision Confirmation';

  const html = `
    <p>Dear ${employeeName},</p>
    <p>We are pleased to inform you that your salary has been revised following the annual compensation review.</p>
    <p>Your dedication, commitment, and valuable contributions to the organization are sincerely appreciated. We look forward to your continued support and contribution toward our shared success.</p>

    <p style="font-weight:bold; margin-bottom:4px;">Salary Revision Details:</p>
    <table style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; margin:12px 0;">
      ${detailRow('Department', department || '-')}
      ${detailRow('Designation', designation || '-')}
      ${detailRow('Date of Joining', dateToDD_MMM_YY(joiningDate))}
      ${detailRow('Previous CTC', `₹${Number(previousCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('Increment', `${incrementPct ?? 0}%`)}
      ${detailRow('Revised CTC', `₹${Number(newCtc || 0).toLocaleString('en-IN')}`)}
      ${detailRow('Effective From', dateToDD_MMM_YY(effectiveFrom))}
    </table>

    <p>Your revised salary will be reflected in the payroll effective from the above date, subject to applicable statutory deductions and company policies.</p>
    <p>Congratulations, and we wish you continued success in your role.</p>
    <p>Should you have any questions regarding this revision, please feel free to contact the HR Department.</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionEmployeeConfirmationTemplate;
