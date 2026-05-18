const dateToDD_MMM_YY4 = require("../utils/dateToDD_MMM_YY");
const checklistTable4  = require("../utils/checklistTable");
 
function weeklyOnboardingTemplate(openDocs, fmsOwner = "HR Team") {
  if (!openDocs.length) {
    return {
      subject: "Weekly Onboarding Summary: NO OPEN FMSs",
      html: "Dear All<br><br>There are no Open FMSs this week.",
    };
  }
 
  let statusPara_Main = "";
  let itemSummaryMain = `<p style="font-size:16px;font-weight:bold;">Here is item-wise summary:</p>`;
 
  let tableSer = 0;
  let overallTotalTasks = 0, doneInTimeTotal = 0, doneButDelayedTotal = 0;
  let tasksDueTotal = 0, tasksOverdueTotal = 0, notYetDueTotal = 0, weekScore = 0;
 
  for (const doc of openDocs) {
    tableSer++;
 
    statusPara_Main += `
      <tr style="border: 1px solid;">
        <td style="border: 1px solid; vertical-align: top; font-weight: bold;">${tableSer}</td>
        <td style="border: 1px solid; vertical-align: top; font-weight: bold;">${doc.name}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.mobile || "-"}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.dept || "-"}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.designation || "-"}</td>
        <td style="border: 1px solid;">${dateToDD_MMM_YY4(doc.offerAcceptedDate)}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.joiningStatus || "-"}</td>
        <td style="border: 1px solid; vertical-align: top;">${dateToDD_MMM_YY4(doc.plannedJoiningDate)}</td>
        <td style="border: 1px solid; vertical-align: top;">${dateToDD_MMM_YY4(doc.joinedDate)}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.remarks || "-"}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.fmsScore ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.totalTasks ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.doneInTime ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.doneButDelayed ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.tasksDue ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top; color:red; background-color:yellow;">${doc.tasksOverdue ?? 0}</td>
        <td style="border: 1px solid; vertical-align: top;">${doc.notYetDue ?? 0}</td>
      </tr>
    `;
 
    overallTotalTasks += doc.totalTasks ?? 0;
    doneInTimeTotal   += doc.doneInTime ?? 0;
    doneButDelayedTotal += doc.doneButDelayed ?? 0;
    tasksDueTotal     += doc.tasksDue ?? 0;
    tasksOverdueTotal += doc.tasksOverdue ?? 0;
    notYetDueTotal    += doc.notYetDue ?? 0;
    weekScore         += doc.fmsScore ?? 0;
 
    itemSummaryMain += `
      <p style="font-size:16px;font-weight:bold;">
        (${tableSer}) ${doc.name}<br>
        Mobile: ${doc.mobile || "-"}<br>
        Dept: ${doc.dept || "-"}<br>
        Designation: ${doc.designation || "-"}<br>
        Joining Status: ${doc.joiningStatus || "-"}
      </p>
      ${checklistTable4(doc.checkLists || [])}
    `;
  }
 
  // Totals row
  statusPara_Main += `
    <tr style="border: 1px solid; font-weight: bold; background-color:lightgrey;">
      <td style="border: 1px solid; vertical-align: top;">FMS Owner</td>
      <td style="border: 1px solid; vertical-align: top;">${fmsOwner}</td>
      <td style="border: 1px solid; vertical-align: top;"> - </td>
      <td style="border: 1px solid; vertical-align: top;">HR Dept</td>
      <td style="border: 1px solid; vertical-align: top;">HR Head</td>
      <td style="border: 1px solid;">Open FMSes</td>
      <td style="border: 1px solid; vertical-align: top;">${openDocs.length}</td>
      <td style="border: 1px solid; vertical-align: top;"> - </td>
      <td style="border: 1px solid; vertical-align: top;"> - </td>
      <td style="border: 1px solid; vertical-align: top;"> - </td>
      <td style="border: 1px solid; vertical-align: top;">${weekScore}</td>
      <td style="border: 1px solid; vertical-align: top;">${overallTotalTasks}</td>
      <td style="border: 1px solid; vertical-align: top;">${doneInTimeTotal}</td>
      <td style="border: 1px solid; vertical-align: top;">${doneButDelayedTotal}</td>
      <td style="border: 1px solid; vertical-align: top;">${tasksDueTotal}</td>
      <td style="border: 1px solid; vertical-align: top; color: red;">${tasksOverdueTotal}</td>
      <td style="border: 1px solid; vertical-align: top;">${notYetDueTotal}</td>
    </tr>
  `;
 
  const html = `
    <p>Dear All,</p>
    <p><span style="font-size:16px">Here is the HR Department Onboarding Summary for the previous week</span></p>
 
    <table style="border: 1px solid; border-collapse: collapse;">
      <tr style="border: 1px solid; font-weight: bold; background-color:lightgrey;">
        <th style="border: 1px solid; vertical-align: top;">Ser</th>
        <th style="border: 1px solid; vertical-align: top;">Name</th>
        <th style="border: 1px solid; vertical-align: top;">Mobile</th>
        <th style="border: 1px solid; vertical-align: top;">Dept</th>
        <th style="border: 1px solid; vertical-align: top;">Desig</th>
        <th style="border: 1px solid; vertical-align: top;">Offer Accepted Date</th>
        <th style="border: 1px solid; vertical-align: top;">Joining Status</th>
        <th style="border: 1px solid; vertical-align: top;">Planned Joining Date</th>
        <th style="border: 1px solid; vertical-align: top;">Joined Date</th>
        <th style="border: 1px solid; vertical-align: top;">Remarks</th>
        <th style="border: 1px solid; vertical-align: top;">FMS Score</th>
        <th style="border: 1px solid; vertical-align: top;">Tasks</th>
        <th style="border: 1px solid; vertical-align: top;">Done</th>
        <th style="border: 1px solid; vertical-align: top;">Done Delayed</th>
        <th style="border: 1px solid; vertical-align: top;">Due</th>
        <th style="border: 1px solid; vertical-align: top; color:red; background-color:yellow;">OverDue</th>
        <th style="border: 1px solid; vertical-align: top;">Not Yet Due</th>
      </tr>
      ${statusPara_Main}
    </table>
 
    ${itemSummaryMain}
  `;
 
  return {
    subject: "Weekly Onboarding Summary: HR Dept",
    html,
  };
}
 
module.exports = weeklyOnboardingTemplate;