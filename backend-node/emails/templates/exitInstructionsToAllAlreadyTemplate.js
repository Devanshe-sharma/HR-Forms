function exitInstructionsToAllAlreadyTemplate(doc, leftDateStr) {
  const primaryEmail = doc.persEmail || doc.officialEmail || "-";
  const html = `
    <p>Dear All,</p>
    <p>${doc.name} Exited Brisk Olive <b>on ${leftDateStr}</b></p>
    <p>Please complete these exiting actions - to ensure smooth transition for the new exit:</p>
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
      <li>DAA: Please keep these ready:
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
    subject: `Hi All, Preparation for New Exit: ${doc.name} left on ${leftDateStr} ( ${primaryEmail} ${doc.mobile || "-"} )`,
    html,
  };
}

module.exports = exitInstructionsToAllAlreadyTemplate;
