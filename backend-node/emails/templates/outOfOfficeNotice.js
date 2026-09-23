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
  // upToDate is only set when the OOO spans past the start day — same-day
  // cases keep the plain "HH:MM - HH:MM" timing they've always shown.
  const upToLabel = doc.upToDate ? `${formatDateIST(doc.upToDate)}, ${doc.upToTime}` : doc.upToTime;
  const timing = `${startTime} - ${upToLabel}`;
  const recordsLink = `${FRONTEND_URL}/attendance?tab=out-of-office`;
  const informedColor = doc.informedStatus === 'advance' ? '#2563eb' : '#dc2626';

  // Only set at all when the entry was late (see routes/outOfOffice.js) —
  // an on-time entry never asked the planned/not-planned question.
  const plannedColor = doc.plannedStatus === 'Planned' ? '#dc2626' : '#059669';
  const plannedLine = doc.plannedStatus
    ? `<br>Planned in Advance: <b><span style="color:${plannedColor}">${doc.plannedStatus}</span></b>`
    : '';
  const lateDetailLines = doc.plannedStatus === 'Not Planned'
    ? `<br>Why Filed Late: <b>${doc.lateReason || '-'}</b>
       <br>When It Was Decided: <b>${doc.unplannedKnownAt ? formatDateIST(doc.unplannedKnownAt) : '-'}</b>`
    : '';
  const escalationLine = doc.plannedStatus === 'Planned'
    ? `<br><span style="color:#dc2626;">An escalation has been raised against <b>${doc.person.name}</b>.</span>`
    : '';

  const subject = `Out-of-Office: ${doc.person.name}, ${dateStr}, ${timing}, ${doc.reason} (Informed ${doc.informedLabel})`;

  const html = `
    <p>Dear All,</p>
    <p>Advance information about <b>Out-of-Office work</b>:
      <br>Person: <b>${doc.person.name}</b>
      <br>Date: <b>${dateStr}</b>
      <br>Timing: <b>${timing}</b>
      <br>Reason: <b>${doc.reason}</b>
      <br>Informed: <b><span style="color:${informedColor}">${doc.informedLabel}</span></b>
      ${plannedLine}
      ${lateDetailLines}
      ${escalationLine}
      <br>Link to Out-of-Office Records: <a href="${recordsLink}" target="_blank">${recordsLink}</a>
    </p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = outOfOfficeNoticeTemplate;
