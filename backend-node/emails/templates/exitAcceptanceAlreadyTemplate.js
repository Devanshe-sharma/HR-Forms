const signature = require("../utils/signature");

function exitAcceptanceAlreadyTemplate(doc) {
  const html = `
    <p>Dear ${doc.name},</p>
    <p>Exit from the Brisk Olive Family!</p>
    <p><b>I hope all these actions have been done. If not, please contact me:</b></p>
    <ul>
      <li>Knowledge Transfer all your tasks to your buddy.</li>
      <li>Handed over all the assets to Admin Dept in good condition.</li>
      <li>Your exit form has been filled and signed by the concerned person.</li>
      <li>Please sign the No Dues certificate &amp; submit to the HR Dept.</li>
      <li>Your Experience letter will be received within one Week.</li>
      <li>Your FnF Salary will be credited to your account within 30 Days.</li>
    </ul>
    ${signature()}
  `;
  return {
    subject: `Exit from Brisk Olive, ${doc.name}`,
    html,
  };
}

module.exports = exitAcceptanceAlreadyTemplate;
