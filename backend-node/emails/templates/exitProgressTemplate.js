const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const checklistTable  = require("../utils/checklistTable");
const signature       = require("../utils/signature");

function exitProgressTemplate(doc) {
  const coloredScore = (doc.fmsScore ?? 0) < 0
    ? `<span style="color:red;">${doc.fmsScore}</span>`
    : doc.fmsScore ?? 0;

  const primaryEmail = doc.persEmail || doc.officialEmail || "-";

  let statusMessage = "";
  if (doc.exitStatus === "Not Exiting") {
    statusMessage = `<li style="color:#d32f2f; font-weight:bold; margin-top:8px;">Their exit has been revoked with Management's approval.</li>`;
  } else if (doc.fmsStatus === "Closed") {
    statusMessage = `<li style="color:#2e7d32; font-weight:bold; margin-top:8px;">Exit process has been successfully completed.</li>`;
  }

  const html = `
    <p>Dear All,</p>
    <p>
      <span style="font-size:16px">Here is the Exit update on: <b>${doc.name}</b></span><br>
      Email: <b>${primaryEmail}</b> Mobile: <b>${doc.mobile || "-"}</b><br>
      Dept: <b>${doc.dept || "-"}</b> Designation: <b>${doc.designation || "-"}</b>
    </p>
    <ul>
      <li><b>Exit Status: ${doc.exitStatus || "-"}</b></li>
      <li>Resignation Date: <b>${dateToDD_MMM_YY(doc.resignationDate)}</b></li>
      <li>Planned Exit: <b>${dateToDD_MMM_YY(doc.plannedExitDate)}</b></li>
      <li>Left Date: <b>${dateToDD_MMM_YY(doc.leftDate)}</b></li>
      <li>FMS Score: <b>${coloredScore}</b> (Total: <b>${doc.totalTasks ?? 0}</b>, Done in Time: <b>${doc.doneInTime ?? 0}</b>, Delayed: <b>${doc.doneButDelayed ?? 0}</b>, <span style="color:red; background-color:yellow;"><b>Overdue: ${doc.tasksOverdue ?? 0}</b></span>, Pending: <b>${doc.tasksDue ?? 0}</b>, Not Due: <b>${doc.notYetDue ?? 0}</b>)</li>
      <li>HR Remarks: <b>${doc.remarks || "-"}</b></li>
      ${statusMessage}
    </ul>
    ${checklistTable(doc.checkLists || [])}
    ${signature()}
  `;

  return {
    subject: `Exit Progress: ${doc.name}`,
    html,
  };
}

module.exports = exitProgressTemplate;
