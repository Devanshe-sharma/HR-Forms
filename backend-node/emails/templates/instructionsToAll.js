const signature = require("../utils/signature");
const formatDateIST = require("../utils/formatDateIST");

function instructionsToAllTemplate({ name, email, mobile, dept, designation, reportingHead, plannedJoiningDate }) {
  const date = formatDateIST(plannedJoiningDate) || "Pending";

  const html = `
    <p>Hello Team,</p>
    <p>${name} will be joining us on <b>${date}</b>.</p>

    <p><b>Employee Details</b></p>
    <ul>
      <li>Name: ${name}</li>
      <li>Designation: ${designation || "-"}</li>
      <li>Department: ${dept || "-"}</li>
      <li>Reporting Manager: ${reportingHead || "-"}</li>
      <li>Phone: ${mobile || "-"}</li>
      <li>Personal Email: ${email || "-"}</li>
    </ul>

    <p>To ensure a smooth onboarding process, concerned teams are requested to complete the following:</p>

    <p><b>HR</b></p>
    <ul>
      <li>Onboarding presentation &amp; company/policy induction</li>
      <li>Employee profile creation in HR Portal</li>
      <li>Document verification &amp; upload</li>
      <li>Official email ID creation</li>
      <li>Attendance &amp; joining formalities</li>
    </ul>

    <p><b>Department</b></p>
    <ul>
      <li>Team introduction</li>
      <li>Role &amp; responsibility briefing</li>
      <li>KRAs/KPIs and initial tasks</li>
      <li>Relevant process/SOP briefing</li>
    </ul>

    <p><b>DME</b></p>
    <ul>
      <li>System/password setup</li>
      <li>Required system access</li>
      <li>Add onboarding checklist in coordination with the Department</li>
    </ul>

    <p><b>Admin</b></p>
    <ul>
      <li>Seating arrangement</li>
      <li>Welcome Kit: Laptop, Charger, Coffee Mug, Pen &amp; Notebook</li>
      <li>T-Shirt size &ndash; please check the T-Shirt Size Sheet or contact the joinee.</li>
      <li>Access/ID card, wherever applicable</li>
    </ul>

    <p>All concerned teams are requested to ensure that the above arrangements are completed before/on the date of joining.</p>
    ${signature()}
  `;
  return {
    subject: `New Joining: ${name}, joining on ${date}`,
    html,
  };
}

module.exports = instructionsToAllTemplate;
