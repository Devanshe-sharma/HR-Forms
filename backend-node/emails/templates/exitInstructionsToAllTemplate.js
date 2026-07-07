function exitInstructionsToAllTemplate(doc, plannedExitDateStr) {
  const primaryEmail = doc.persEmail || doc.officialEmail || "-";
  const html = `
    <p>Dear All,</p>
    <p>${doc.name} will be Exiting Brisk Olive on ${plannedExitDateStr}</p>
    <p>Please complete these pre-Exiting actions - to ensure a smooth transition:
    <br>(Exit's contact details are: ${primaryEmail} ${doc.mobile || "-"})</p>
    <ul>
      <li>HR: Please prepare:
        <ul>
          <li>Printout of Exit Email.</li>
          <li>Conducting Exit Interview with Management.</li>
          <li>Sign Exit form from Employee.</li>
          <li>Close the contract &amp; Archive the employee profile on Odoo.</li>
          <li>Sent an FnF approval email to Management.</li>
          <li>Issue Experience Letter.</li>
        </ul>
      </li>
      <li>DAA: Please delete these:
        <ul>
          <li>Remove the Name &amp; all access from Shared drive.</li>
          <li>Name deleted from Employee list.</li>
          <li>Reallotment Delegation &amp; Checklist Task.</li>
        </ul>
      </li>
      <li>Admin: Please keep these ready:
        <ul>
          <li>Reassign Assets.</li>
          <li>Tea Party.</li>
        </ul>
      </li>
      <li>Accounts: Please release:
        <ul>
          <li>FnF Salary.</li>
        </ul>
      </li>
    </ul>
    <p>Please reach out to me for any clarifications.</p>
  `;
  return {
    subject: `Hi All, Preparation for New Exit: ${doc.name} Exiting on ${plannedExitDateStr} ( ${primaryEmail} ${doc.mobile || "-"} )`,
    html,
  };
}

module.exports = exitInstructionsToAllTemplate;
