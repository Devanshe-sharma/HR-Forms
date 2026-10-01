const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

// One row per employee whose Salary Revision Due Date falls in the given
// fiscal quarter. `rows` items: { name, department, designation,
// joiningDate, doneDate, dueDate }.
function buildTable(rows) {
  const body = rows.map((r, i) => `
    <tr style="border:1px solid;">
      <td style="border:1px solid; padding:6px; vertical-align:top;">${i + 1}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top; font-weight:bold;">${r.name || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${r.department || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${r.designation || '-'}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${dateToDD_MMM_YY(r.joiningDate)}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top;">${dateToDD_MMM_YY(r.doneDate)}</td>
      <td style="border:1px solid; padding:6px; vertical-align:top; font-weight:bold;">${dateToDD_MMM_YY(r.dueDate)}</td>
    </tr>`).join('');

  return `
    <table style="border:1px solid; border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px;">
      <tr style="border:1px solid; font-weight:bold; background-color:lightgrey;">
        <th style="border:1px solid; padding:6px;">Ser</th>
        <th style="border:1px solid; padding:6px;">Name</th>
        <th style="border:1px solid; padding:6px;">Department</th>
        <th style="border:1px solid; padding:6px;">Designation</th>
        <th style="border:1px solid; padding:6px;">Date of Joining</th>
        <th style="border:1px solid; padding:6px;">Service Completion</th>
        <th style="border:1px solid; padding:6px;">Due Date</th>
      </tr>
      ${body}
    </table>`;
}

// recipientName lets the same template serve both the Management-wide
// digest (every due employee, default greeting) and a per-manager digest
// (that manager's own direct reports only — see sendSalaryRevisionDue.js)
// with an appropriately personal greeting, without duplicating the table
// markup or subject-line convention between the two.
function salaryRevisionDueTemplate(rows, quarterLabel, recipientName = 'Management') {
  if (!rows.length) {
    return {
      subject: `Salary Revision — No Revisions Due in ${quarterLabel}`,
      html: `<p>Dear ${recipientName},</p><p>No employees have a Salary Revision due in <b>${quarterLabel}</b>.</p>${signature()}`,
    };
  }

  const html = `
    <p>Dear ${recipientName},</p>
    <p>The following employee${rows.length === 1 ? ' has' : 's have'} a Salary Revision due in <b>${quarterLabel}</b>:</p>
    ${buildTable(rows)}
    ${signature()}
  `;

  return {
    subject: `Salary Revision — Due This Quarter (${rows.length}) — ${quarterLabel}`,
    html,
  };
}

module.exports = salaryRevisionDueTemplate;
