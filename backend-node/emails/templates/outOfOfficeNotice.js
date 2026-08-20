const signature = require('../../utils/signature');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtStartTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
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
