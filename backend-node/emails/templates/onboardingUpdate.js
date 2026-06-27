const dateToDD_MMM_YY2 = require("../utils/dateToDD_MMM_YY");
const checklistTable2  = require("../utils/checklistTable");
const signature        = require("../utils/signature");

function onboardingUpdateTemplate(doc) {
  const coloredScore = (doc.fmsScore ?? 0) < 0
    ? `<span style="color:red;">${doc.fmsScore}</span>`
    : doc.fmsScore ?? 0;

  const email = doc.officialEmail || doc.persEmail || "-";

  let completionRow = "";
  if (doc.fmsStatus === "Closed") {
    completionRow = `
      <tr style="border: 1px solid; color:green;">
        <td style="border: 1px solid; color:green; vertical-align: top;">
          <b> CONGRATULATIONS! ALL TASKS DONE. ONBOARDING COMPLETE</b>
        </td>
      </tr>
    `;
  }

  const html = `
    <p>Dear All,</p>
    <p>
      <span style="font-size:16px">Onboarding update for: <b>${doc.name}</b></span><br>
      Email: <b>${email}</b> Mobile: <b>${doc.mobile || "-"}</b><br>
      Dept: <b>${doc.dept || "-"}</b> Designation: <b>${doc.designation || "-"}</b>
    </p>
    <ul>
      <li>Joining Status: <b>${doc.joiningStatus || "-"}</b></li>
      <li>Offer Accepted: <b>${dateToDD_MMM_YY2(doc.offerAcceptedDate)}</b></li>
      <li>Planned Joining: <b>${dateToDD_MMM_YY2(doc.plannedJoiningDate)}</b></li>
      <li>Joined On: <b>${dateToDD_MMM_YY2(doc.joinedDate)}</b></li>
      <li>FMS Score: <b>${coloredScore}</b> (Total Tasks: <b>${doc.totalTasks ?? 0}</b>, Done in Time: <b>${doc.doneInTime ?? 0}</b>, <u>Done but Delayed: <b>${doc.doneButDelayed ?? 0}</b></u>, <b><span style="color:red; background-color:yellow;"> Overdue: ${doc.tasksOverdue ?? 0}</span></b>, <span style="background-color:yellow;"><b>Pending - but not delayed: ${doc.tasksDue ?? 0}</b></span>, Not Yet Due: <b>${doc.notYetDue ?? 0}</b>)</li>
      <li>HR Remarks: <b>${doc.remarks || "-"}</b></li>
    </ul>
    ${completionRow ? `<table style="border:1px solid;border-collapse:collapse;">${completionRow}</table>` : checklistTable2(doc.checkLists || [])}
    ${signature()}
  `;
  return {
    subject: `Onboarding Update: ${doc.name}`,
    html,
  };
}

module.exports = onboardingUpdateTemplate;
