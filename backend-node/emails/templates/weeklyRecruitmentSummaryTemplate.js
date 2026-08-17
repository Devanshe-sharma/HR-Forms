const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const checklistTable  = require("../utils/checklistTable");
const signature       = require("../utils/signature");

// checklist_tasks on HiringRequisition is a flat array (task/status/score/
// daysLeft), unlike the grouped {name, itemsList} shape checklistTable()
// expects for Onboarding/Exit — wrap it in a single unnamed group so the
// same renderer can be reused instead of duplicating the table markup.
function checklistTasksTable(checklistTasks = []) {
  if (!checklistTasks.length) return "";
  return checklistTable([
    {
      name: "Checklist",
      planDate: null,
      itemsList: checklistTasks.map((t) => ({
        name: t.task,
        status: t.status,
        score: t.score,
        daysLeft: t.daysLeft,
      })),
    },
  ]);
}

// One row per open requisition, worst FMS score first (mirrors the
// oldest/worst-first ordering used by the exit/onboarding weekly summaries).
function buildSummaryTable(openRequisitions) {
  let totalTasks = 0, doneInTime = 0, doneButDelayed = 0,
      tasksDue = 0, tasksOverdue = 0, notYetDue = 0, weekScore = 0;

  const rows = openRequisitions.map((doc, i) => {
    totalTasks     += doc.total_tasks     ?? 0;
    doneInTime     += doc.done_in_time    ?? 0;
    doneButDelayed += doc.done_but_delayed ?? 0;
    tasksDue       += doc.tasks_due       ?? 0;
    tasksOverdue   += doc.tasks_overdue   ?? 0;
    notYetDue      += doc.not_yet_due     ?? 0;
    weekScore      += doc.fms_score       ?? 0;

    return `
      <tr style="border:1px solid;">
        <td style="border:1px solid; vertical-align:top; font-weight:bold;">${i + 1}</td>
        <td style="border:1px solid; vertical-align:top; font-weight:bold;">${doc.designation || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.hiring_dept || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.requisitioner_name || "-"}</td>
        <td style="border:1px solid;">${dateToDD_MMM_YY(doc.request_date)}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.hiring_status || "-"}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.fms_score ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.total_tasks ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.done_in_time ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.done_but_delayed ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.tasks_due ?? 0}</td>
        <td style="border:1px solid; vertical-align:top; color:red; background-color:yellow;">${doc.tasks_overdue ?? 0}</td>
        <td style="border:1px solid; vertical-align:top;">${doc.not_yet_due ?? 0}</td>
      </tr>`;
  }).join("");

  const totalsRow = `
    <tr style="border:1px solid; font-weight:bold; background-color:lightgrey;">
      <td style="border:1px solid;">Totals</td>
      <td style="border:1px solid;">Open Requisitions: ${openRequisitions.length}</td>
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
        <th style="border:1px solid; vertical-align:top;">Designation</th>
        <th style="border:1px solid; vertical-align:top;">Dept</th>
        <th style="border:1px solid; vertical-align:top;">Requisitioner</th>
        <th style="border:1px solid; vertical-align:top;">Request Date</th>
        <th style="border:1px solid; vertical-align:top;">Hiring Status</th>
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

function buildItemWiseSummary(openRequisitions) {
  return openRequisitions.map((doc, i) => `
    <p style="font-size:16px; font-weight:bold;">
      (${i + 1}) ${doc.designation || "-"}<br>
      Dept: ${doc.hiring_dept || "-"}<br>
      Requisitioner: ${doc.requisitioner_name || "-"}<br>
      Hiring Status: ${doc.hiring_status || "-"}
    </p>
    ${checklistTasksTable(doc.checklist_tasks || [])}
  `).join("");
}

function weeklyRecruitmentSummaryTemplate(openRequisitions) {
  if (openRequisitions.length === 0) {
    return {
      subject: "Weekly Recruitment Summary: NO OPEN REQUISITIONS",
      html: `<p>Dear All,</p><p>There are no open hiring requisitions this week.</p>${signature()}`,
    };
  }

  const html = `
    <p>Dear All,</p>
    <p><span style="font-size:16px">Here is the HR Department Recruitment Summary for the previous week</span></p>
    ${buildSummaryTable(openRequisitions)}
    <p style="font-size:16px; font-weight:bold;">Here is item-wise summary:</p>
    ${buildItemWiseSummary(openRequisitions)}
    ${signature()}
  `;

  return {
    subject: "Weekly Recruitment Summary: HR Dept",
    html,
  };
}

module.exports = weeklyRecruitmentSummaryTemplate;
