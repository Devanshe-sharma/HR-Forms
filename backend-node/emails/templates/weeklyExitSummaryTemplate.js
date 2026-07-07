const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const checklistTable  = require("../utils/checklistTable");
const signature       = require("../utils/signature");

// ─── Main summary table (one row per open exit, plus a totals row) ─────────
function buildSummaryTable(openExits) {
  let totalTasks = 0, doneInTime = 0, doneButDelayed = 0,
      tasksDue = 0, tasksOverdue = 0, notYetDue = 0, weekScore = 0;

  const rows = openExits.map((doc, i) => {
    totalTasks     += doc.totalTasks     ?? 0;
    doneInTime     += doc.doneInTime     ?? 0;
    doneButDelayed += doc.doneButDelayed ?? 0;
    tasksDue       += doc.tasksDue       ?? 0;
    tasksOverdue   += doc.tasksOverdue   ?? 0;
    notYetDue      += doc.notYetDue      ?? 0;
    weekScore      += doc.fmsScore       ?? 0;

    return `
      <tr style="border:1px solid;">
        <td style="border:1px solid; vertical-align:top; font-weight:bold;">${i + 1}</td>
        <td style="border:1px solid; vertical-align:top; font-weight:bold;">${doc.name || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.mobile || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.dept || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.designation || "-"}</td>
        <td style="border:1px solid;">${dateToDD_MMM_YY(doc.resignationDate)}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.exitStatus || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${dateToDD_MMM_YY(doc.plannedExitDate)}</td>
        <td style="border:1px solid; vertical-align:top;">${dateToDD_MMM_YY(doc.leftDate)}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.remarks || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.fmsScore ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.totalTasks ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.doneInTime ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.doneButDelayed ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.tasksDue ?? 0}</td>
        <td style="border:1px solid; vertical-align:top; color:red; background-color:yellow;">${doc.tasksOverdue ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.notYetDue ?? 0}</td>
      </tr>`;
  }).join("");

  const totalsRow = `
    <tr style="border:1px solid; font-weight:bold; background-color:lightgrey;">
      <td style="border:1px solid;">Totals</td>
      <td style="border:1px solid;">Open FMSes: ${openExits.length}</td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;"> - </td>
      <td style="border:1px solid;">${weekScore}</td>
      <td style="border:1px solid;">${totalTasks}</td>
      <td style="border:1px solid;">${doneInTime}</td>
      <td style="border:1px solid;">${doneButDelayed}</td>
      <td style="border:1px solid;">${tasksDue}</td>
      <td style="border:1px solid; color:red;">${tasksOverdue}</td>
      <td style="border:1px solid;">${notYetDue}</td>
    </tr>`;

  return `
    <table style="border:1px solid; border-collapse:collapse;">
      <tr style="border:1px solid; font-weight:bold; background-color:lightgrey;">
        <th style="border:1px solid; vertical-align:top;">Ser</th>
        <th style="border:1px solid; vertical-align:top;">Name</th>
        <th style="border:1px solid; vertical-align:top;">Mobile</th>
        <th style="border:1px solid; vertical-align:top;">Dept</th>
        <th style="border:1px solid; vertical-align:top;">Desig</th>
        <th style="border:1px solid; vertical-align:top;">Resignation Email Sent on</th>
        <th style="border:1px solid; vertical-align:top;">Exit Status</th>
        <th style="border:1px solid; vertical-align:top;">Planned Exit Date</th>
        <th style="border:1px solid; vertical-align:top;">Left Date</th>
        <th style="border:1px solid; vertical-align:top;">Remarks</th>
        <th style="border:1px solid; vertical-align:top;">FMS Score</th>
        <th style="border:1px solid; vertical-align:top;">Tasks</th>
        <th style="border:1px solid; vertical-align:top;">Done</th>
        <th style="border:1px solid; vertical-align:top;">Done Delayed</th>
        <th style="border:1px solid; vertical-align:top;">Due</th>
        <th style="border:1px solid; vertical-align:top; color:red; background-color:yellow;">OverDue</th>
        <th style="border:1px solid; vertical-align:top;">Not Yet Due</th>
      </tr>
      ${rows}
      ${totalsRow}
    </table>`;
}

// ─── Per-person item-wise detail (reuses the same checklistTable util
// already used for the per-record progress emails, for visual consistency) ──
function buildItemWiseSummary(openExits) {
  return openExits.map((doc, i) => `
    <p style="font-size:16px; font-weight:bold;">
      (${i + 1}) ${doc.name || "-"}<br>
      Mobile: ${doc.mobile || "-"}<br>
      Dept: ${doc.dept || "-"}<br>
      Designation: ${doc.designation || "-"}<br>
      Exit Intimation Date: ${dateToDD_MMM_YY(doc.resignationDate)}
    </p>
    ${checklistTable(doc.checkLists || [])}
  `).join("");
}

function weeklyExitSummaryTemplate(openExits) {
  if (openExits.length === 0) {
    return {
      subject: "Weekly Exit Progress: NO OPEN FMSs",
      html: `<p>Dear All,</p><p>There are no Open FMSs this week.</p>${signature()}`,
    };
  }

  const htmlIntro = `
    <p>Dear All,</p>
    <p><span style="font-size:16px">Here is the HR Department Exit Summary for the previous week</span></p>
  `;

  const html = htmlIntro
    + buildSummaryTable(openExits)
    + `<p style="font-size:16px; font-weight:bold;">Here is item-wise summary:</p>`
    + buildItemWiseSummary(openExits)
    + signature();

  return {
    subject: "Weekly Exit Progress: HR Dept",
    html,
  };
}

module.exports = weeklyExitSummaryTemplate;