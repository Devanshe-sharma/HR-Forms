const moment = require('moment-timezone');
const sendEmail = require('../sendEmail');
const CandidateApplication = require('../../models/Candidateapplication');

// Runs at 9 AM IST daily (see the cron schedule added to index.js) —
// covers the FULL PREVIOUS calendar day's applications, not literally
// "since midnight today". Date boundaries are computed explicitly in
// IST via moment-timezone rather than plain JS Date math, to avoid the
// same UTC-offset day-shift bug found and fixed elsewhere in this
// codebase tonight (a server running in UTC would otherwise read
// "today" as ending 5.5 hours early).
async function sendDailyApplicantSummary() {
  const yesterdayStart = moment().tz('Asia/Kolkata').subtract(1, 'day').startOf('day').toDate();
  const yesterdayEnd   = moment().tz('Asia/Kolkata').subtract(1, 'day').endOf('day').toDate();

  const applicants = await CandidateApplication.find({
    createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
  }).sort({ createdAt: 1 });

  const dateLabel = moment(yesterdayStart).tz('Asia/Kolkata').format('DD MMM YYYY');

  let html;
  if (applicants.length === 0) {
    // Sent either way, not skipped — HR seeing "0 applications" confirms
    // the system is alive and there's genuinely nothing to report,
    // rather than leaving them wondering whether an email just failed
    // to arrive.
    html = `
      <p>Dear HR,</p>
      <p>No new candidate applications were received on <b>${dateLabel}</b>.</p>
    `;
  } else {
    const rows = applicants.map((a, i) => `
      <tr>
        <td style="border:1px solid #ccc; padding:6px; text-align:center;">${i + 1}</td>
        <td style="border:1px solid #ccc; padding:6px;">${a.full_name || '-'}</td>
        <td style="border:1px solid #ccc; padding:6px;">${a.designation || '-'}</td>
        <td style="border:1px solid #ccc; padding:6px;">${a.email || '-'}</td>
        <td style="border:1px solid #ccc; padding:6px;">${a.phone || '-'}</td>
        <td style="border:1px solid #ccc; padding:6px; text-align:center;">${moment(a.createdAt).tz('Asia/Kolkata').format('hh:mm A')}</td>
      </tr>
    `).join('');

    html = `
      <p>Dear HR,</p>
      <p><b>${applicants.length}</b> candidate application(s) were received on <b>${dateLabel}</b>:</p>
      <table style="border:1px solid #ccc; border-collapse:collapse; width:100%; font-family:Arial,sans-serif; font-size:13px;">
        <tr style="background:#f0f0f0; font-weight:bold;">
          <th style="border:1px solid #ccc; padding:6px;">#</th>
          <th style="border:1px solid #ccc; padding:6px;">Name</th>
          <th style="border:1px solid #ccc; padding:6px;">Designation</th>
          <th style="border:1px solid #ccc; padding:6px;">Email</th>
          <th style="border:1px solid #ccc; padding:6px;">Phone</th>
          <th style="border:1px solid #ccc; padding:6px;">Applied At</th>
        </tr>
        ${rows}
      </table>
    `;
  }

  await sendEmail({
    to: 'hr.manager@briskolive.com,hr.head@briskolive.com',
    cc: 'software.developer@briskolive.com',
    subject: `Daily Applicant Summary — ${dateLabel} (${applicants.length} application${applicants.length === 1 ? '' : 's'})`,
    html,
  });
}

module.exports = sendDailyApplicantSummary;