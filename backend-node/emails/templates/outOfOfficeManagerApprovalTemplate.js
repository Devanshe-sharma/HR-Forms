const signature = require('../../utils/signature');
const actionButton = require('../utils/actionButton');
const formatDateIST = require('../utils/formatDateIST');

function fmtDate(d) {
  return formatDateIST(d);
}

function fmtStartTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

// Sent to the reporting manager the moment an out-of-office is logged —
// asks them to approve or reject it, with a reason required on rejection.
function outOfOfficeManagerApprovalTemplate(doc) {
  const dateStr = fmtDate(doc.startDateTime);
  const startTime = fmtStartTime(doc.startDateTime);
  const upToLabel = doc.upToDate ? `${formatDateIST(doc.upToDate)}, ${doc.upToTime}` : doc.upToTime;
  const timing = `${startTime} - ${upToLabel}`;

  const subject = `Approval needed: Out-of-Office — ${doc.person.name}, ${dateStr}`;

  const html = `
    <p>Dear ${doc.manager?.name || 'Manager'},</p>
    <p><b>${doc.person.name}</b> has logged the following out-of-office request, which needs your approval:
      <br>Date: <b>${dateStr}</b>
      <br>Timing: <b>${timing}</b>
      <br>Reason: <b>${doc.reason}</b>
    </p>
    <p>Please review and approve or reject this request using the button below. A reason is required if you reject it.</p>
    ${actionButton(doc.actionLink, 'Review Request')}
    ${signature()}
  `;

  return { subject, html };
}

module.exports = outOfOfficeManagerApprovalTemplate;
