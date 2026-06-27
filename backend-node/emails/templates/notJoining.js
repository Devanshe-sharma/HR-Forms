const dateToDD_MMM_YY3 = require("../utils/dateToDD_MMM_YY");
const signature        = require("../utils/signature");

function notJoiningTemplate(doc) {
  const email = doc.officialEmail || doc.persEmail || "-";

  const html = `
    <p>Dear All,</p>
    <p>
      <span style="font-size:16px">Onboarding entry for: <b>${doc.name}</b></span><br>
      Email: <b>${email}</b> Mobile: <b>${doc.mobile || "-"}</b><br>
      Dept: <b>${doc.dept || "-"}</b> Designation: <b>${doc.designation || "-"}</b>
    </p>
    <ul>
      <li>Joining Status: <b>${doc.joiningStatus || "-"}</b></li>
      <li>Offer Accepted: <b>${dateToDD_MMM_YY3(doc.offerAcceptedDate)}</b></li>
      <li>Planned Joining: <b>${dateToDD_MMM_YY3(doc.plannedJoiningDate)}</b></li>
      <li>Joined On: <b>${dateToDD_MMM_YY3(doc.joinedDate)}</b></li>
    </ul>
    <p style="font-weight:bold; font-size:16px; color:red;">
      The individual is not joining. The onboarding entry has been closed.
    </p>
    ${signature()}
  `;
  return {
    subject: `${doc.name} is NOT joining. Onboarding entry has been closed.`,
    html,
  };
}

module.exports = notJoiningTemplate;
