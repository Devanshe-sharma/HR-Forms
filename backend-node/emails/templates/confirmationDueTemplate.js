const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

// One row per employee whose probation confirmation date falls in the
// given fiscal quarter. Mirrors salaryRevisionDueTemplate.js's table
// layout exactly. `rows` items: { name, department, designation,
// joiningDate, confirmationDate }.
function buildTable(rows) {
  const body = rows.map((r, i) => `
    <tr style="border:1px solid;">
      <td style="border:1px solid; padding:6px; vertical-align:top;">${i + 1}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top; font-weight:bold;">${r.name || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${r.department || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${r.designation || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${dateToDD_MMM_YY(r.joiningDate)}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top; font-weight:bold;">${dateToDD_MMM_YY(r.confirmationDate)}</td>
    </tr>`).join('');

  return `
    <table style="border:1px solid; border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px;">
      <tr style="border:1px solid; font-weight:bold; background-color:lightgrey;">
        <th style="border:1px solid; padding:6px;">Ser</th>
        <th style="border:1px solid; padding:6px;">Name</th>
        <th style="border:1px solid; padding:6px;">Department</th>
        <th style="border:1px solid; padding:6px;">Designation</th>
        <th style="border:1px solid; padding:6px;">Date of Joining</th>
        <th style="border:1px solid; padding:6px;">Confirmation Date</th>
      </tr>
      ${body}
    </table>`;
}

function confirmationDueTemplate(rows, quarterLabel) {
  if (!rows.length) {
    return {
      subject: `Probation Confirmation — No Confirmations Due in ${quarterLabel}`,
      html: `<p>Dear Management,</p><p>No employees have a probation confirmation due in <b>${quarterLabel}</b>.</p>${signature()}`,
    };
  }

  const html = `
    <p>Dear Management,</p>
    <p>The following employees have a probation confirmation due in <b>${quarterLabel}</b>:</p>
    ${buildTable(rows)}
    ${signature()}
  `;

  return {
    subject: `Probation Confirmation — Due This Quarter (${rows.length}) — ${quarterLabel}`,
    html,
  };
}

module.exports = confirmationDueTemplate;
