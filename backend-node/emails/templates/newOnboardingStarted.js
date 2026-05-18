const dateToDD_MMM_YY = require("../utils/dateToDD_MMM_YY");
const checklistTable  = require("../utils/checklistTable");
 
function newOnboardingStartedTemplate(doc) {
  const coloredScore = (doc.fmsScore ?? 0) < 0
    ? `<span style="color:red;">${doc.fmsScore}</span>`
    : doc.fmsScore ?? 0;
 
  const html = `
    <p>Dear All,</p>
    <p>
      <span style="font-size:16px">A new Joinee Onboarding has started for: <b>${doc.name}</b></span><br>
      Email: <b>${doc.officialEmail || doc.persEmail || "-"}</b> Mobile: <b>${doc.mobile || "-"}</b><br>
      Dept: <b>${doc.dept || "-"}</b> Designation: <b>${doc.designation || "-"}</b>
    </p>
    <ul>
      <li>Joining Status: <b>${doc.joiningStatus || "-"}</b></li>
      <li>Offer Accepted: <b>${dateToDD_MMM_YY(doc.offerAcceptedDate)}</b></li>
      <li>Planned Joining: <b>${dateToDD_MMM_YY(doc.plannedJoiningDate)}</b></li>
      <li>Joined On: <b>${dateToDD_MMM_YY(doc.joinedDate)}</b></li>
      <li>FMS Score: <b>${coloredScore}</b> (Total Tasks: <b>${doc.totalTasks ?? 0}</b>, Done in Time: <b>${doc.doneInTime ?? 0}</b>, <u>Done but Delayed: <b>${doc.doneButDelayed ?? 0}</b></u>, <span style="color:red; background-color:yellow;"><b> Overdue: ${doc.tasksOverdue ?? 0}</b></span>, <span style="background-color:yellow;"><b>Pending - but not delayed: ${doc.tasksDue ?? 0}</b></span>, Not Yet Due: <b>${doc.notYetDue ?? 0}</b>)</li>
      <li>HR Remarks: <b>${doc.remarks || "-"}</b></li>
    </ul>
    ${checklistTable(doc.checkLists || [])}
  `;
 
  return {
    subject: `New Onboarding Started for: ${doc.name}`,
    html,
  };
}
 
module.exports = newOnboardingStartedTemplate;