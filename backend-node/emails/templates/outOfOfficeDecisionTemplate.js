const signature = require('../../utils/signature');
const formatDateIST = require('../utils/formatDateIST');

function fmtDate(d) {
  return formatDateIST(d);
}

// Sent once the manager approves or rejects an out-of-office request —
// informs whoever logged it (and HR) of the outcome.
function outOfOfficeDecisionTemplate(doc) {
  const dateStr = fmtDate(doc.startDateTime);
  const approved = doc.approval.status === 'approved';

  const subject = `Out-of-Office ${approved ? 'Approved' : 'Rejected'}: ${doc.person.name}, ${dateStr}`;

  const html = `
    <p>Dear All,</p>
    <p>${doc.manager?.name || 'The reporting manager'} has
      <b style="color:${approved ? '#16a34a' : '#dc2626'}">${approved ? 'approved' : 'rejected'}</b>
      the out-of-office request for <b>${doc.person.name}</b> on <b>${dateStr}</b>.
      ${!approved ? `<br>Reason: <b>${doc.approval.reason}</b>` : ''}
    </p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = outOfOfficeDecisionTemplate;
