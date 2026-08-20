const signature = require('../../utils/signature');
const formatDateIST = require('../utils/formatDateIST');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// Must render in IST regardless of the server's own timezone, or a UTC-hosted
// process shows a UTC-shifted hour instead of the time that was actually
// picked in the (IST) browser — see emails/utils/formatDateIST.js.
function fmtDate(d) {
  return formatDateIST(d);
}

function fmtStartTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

// Sent whenever an employee's out-of-office is logged — notifies HR with a
// copy to the person, the submitter, and anyone kept in cc.
function outOfOfficeNoticeTemplate(doc) {
  const dateStr = fmtDate(doc.startDateTime);
  const startTime = fmtStartTime(doc.startDateTime);
  const timing = `${startTime} - ${doc.upToTime}`;
  const recordsLink = `${FRONTEND_URL}/attendance?tab=out-of-office`;
  const informedColor = doc.informedStatus === 'advance' ? '#2563eb' : '#dc2626';

  const subject = `Out-of-Office: ${doc.person.name}, ${dateStr}, ${timing}, ${doc.reason} (Informed ${doc.informedLabel})`;

  const html = `
    <p>Dear All,</p>
    <p>Advance information about <b>Out-of-Office work</b>:
      <br>Person: <b>${doc.person.name}</b>
      <br>Date: <b>${dateStr}</b>
      <br>Timing: <b>${timing}</b>
      <br>Reason: <b>${doc.reason}</b>
      <br>Informed: <b><span style="color:${informedColor}">${doc.informedLabel}</span></b>
      <br>Link to Out-of-Office Records: <a href="${recordsLink}" target="_blank">${recordsLink}</a>
    </p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = outOfOfficeNoticeTemplate;
