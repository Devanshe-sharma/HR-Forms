const signature = require("../utils/signature");

function exitAcceptanceTemplate(doc, plannedExitDateStr) {
  const html = `
    <p>Dear ${doc.name},</p>
    <p>Refer your resignation mail. Your resignation has been accepted by the Management. Your last planned working date is: <b>${plannedExitDateStr}</b></p>
    <p>Please take these actions before your exit - to help in your smooth transition:</p>
    <p><b>Before Exit:</b></p>
    <ul>
      <li>On the day of resignation accepted, You have to ensure following tasks.
        <ul>
          <li>Knowledge Transfer all your tasks to your buddy.</li>
          <li>Handed over all the assets to Admin Dept in good condition.</li>
          <li>Your exit form has been filled and signed by the concerned person.</li>
          <li>Please sign the No Dues certificate &amp; submit to the HR Dept.</li>
        </ul>
      </li>
    </ul>
    <p><b>After Exit:</b></p>
    <ul>
      <li>Your Experience letter will be received within one Week.</li>
      <li>Your FnF Salary will be credited to your account within 30 Days.</li>
    </ul>
    ${signature()}
  `;
  return {
    subject: `Acceptance of Exit from Brisk Olive, ${doc.name}`,
    html,
  };
}

module.exports = exitAcceptanceTemplate;
