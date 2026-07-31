function formatDate(d) {
  if (!d) return 'To be confirmed';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Solid colors only (no gradients) — Outlook desktop's Word rendering engine
// drops CSS gradients silently, so a solid brand color is the safe choice
// for a banner background that has to render the same everywhere.
const STATUS_STYLE = {
  schedule:   { label: 'Scheduled',   bg: '#e3f2fd', color: '#0d47a1', border: '#1976d2' },
  reschedule: { label: 'Rescheduled', bg: '#fff8e1', color: '#e65100', border: '#ffa000' },
  cancel:     { label: 'Cancelled',   bg: '#fce4ec', color: '#880e4f', border: '#e91e63' },
};

// type: 'schedule' | 'reschedule' | 'cancel'
// audience: 'interviewer' | 'candidate'
// confirmLinks: { yes, maybe, no } — full URLs to the public /respond
// endpoint, only meaningful for schedule/reschedule mails sent to the
// candidate. "Can't attend" doesn't record anything on click — it opens a
// short reason form first (see routes/applicantRecords.js).
function interviewRoundMailTemplate({ type, audience, candidateName, position, round, cancellationReason, confirmLinks }) {
  const stage  = round.stage || 'Interview';
  const date   = formatDate(round.scheduledDate);
  const time   = round.scheduledTime || 'To be confirmed';
  const mode   = round.mode || 'To be decided';
  const link   = round.meetingLink || '';
  const isUrl  = /^https?:\/\//i.test(link);
  const status = STATUS_STYLE[type];

  const subject = audience === 'interviewer'
    ? `Interview ${status.label} — ${candidateName} (${position}) — ${stage}`
    : `Your Interview has been ${status.label} — ${position}`;

  const greeting = audience === 'interviewer' ? 'Dear Interviewer,' : `Dear ${candidateName},`;

  let intro;
  if (type === 'cancel') {
    intro = audience === 'interviewer'
      ? 'This is to inform you that the following interview has been cancelled.'
      : 'We regret to inform you that your interview has been cancelled. Our team will get in touch regarding next steps.';
  } else if (type === 'reschedule') {
    intro = audience === 'interviewer'
      ? 'The interview below has been rescheduled. Please find the updated details:'
      : 'Your interview has been rescheduled. Please find the updated details below:';
  } else {
    intro = audience === 'interviewer'
      ? 'You have been scheduled to interview the candidate below:'
      : 'Your interview has been scheduled. Please find the details below:';
  }

  const rows = [
    ['Candidate', candidateName],
    ['Position', position],
    ['Round', stage],
    ['Date', date],
    ['Time', time],
    ['Mode', mode],
  ];
  if (link) {
    rows.push([isUrl ? 'Meeting Link' : 'Location', isUrl ? `<a href="${link}" style="color:#1a3e72;text-decoration:underline;">${link}</a>` : link]);
  }

  const detailsTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="border-collapse:collapse;border:1px solid #e4eaf4;border-radius:8px;margin:20px 0;">
      ${rows.map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafd' : '#ffffff'};">
          <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#5a6a85;width:150px;border-bottom:1px solid #eef2f8;">${label}</td>
          <td style="padding:10px 16px;font-size:14px;color:#1a2438;border-bottom:1px solid #eef2f8;">${value}</td>
        </tr>
      `).join('')}
    </table>
  `;

  // Internal cancellation reasons are shared with the interviewer (so they
  // understand why) but not with the candidate, to avoid oversharing
  // internal scheduling/process details externally.
  const reasonBlock = (type === 'cancel' && audience === 'interviewer' && cancellationReason)
    ? `
      <div style="background:#fff5f7;border-left:4px solid #e91e63;padding:12px 16px;border-radius:4px;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#880e4f;"><strong>Reason:</strong> ${cancellationReason}</p>
      </div>
    `
    : '';

  const ctaButton = (type !== 'cancel' && isUrl)
    ? `
      <p style="text-align:center;margin:28px 0 8px;">
        <a href="${link}" style="display:inline-block;background:#7a8b2e;color:#ffffff;padding:13px 32px;
          text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
          ${/virtual|video/i.test(mode) ? 'Join Interview' : 'View Meeting Details'}
        </a>
      </p>
    `
    : '';

  const confirmButtons = (type !== 'cancel' && audience === 'candidate' && confirmLinks)
    ? `
      <div style="margin:24px 0 4px;">
        <p style="font-size:13px;font-weight:700;color:#5a6a85;margin:0 0 10px;">
          Please confirm your availability for this interview:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:0 4px 0 0;" width="33%">
              <a href="${confirmLinks.yes}" style="display:block;text-align:center;background:#28a745;color:#ffffff;
                padding:12px 6px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">
                ✓ Yes, I'll attend
              </a>
            </td>
            <td style="padding:0 4px;" width="33%">
              <a href="${confirmLinks.maybe}" style="display:block;text-align:center;background:#fb8c00;color:#ffffff;
                padding:12px 6px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">
                ? Maybe
              </a>
            </td>
            <td style="padding:0 0 0 4px;" width="33%">
              <a href="${confirmLinks.no}" style="display:block;text-align:center;background:#dc3545;color:#ffffff;
                padding:12px 6px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">
                ✗ Can't attend
              </a>
            </td>
          </tr>
        </table>
      </div>
    `
    : '';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#f4f6fa;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4eaf4;">

        <div style="background:#1a3e72;padding:24px 28px;">
          <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Brisk Olive HR</p>
          <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Interview ${status.label}</h2>
        </div>

        <div style="padding:28px;">
          <span style="display:inline-block;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;
            background:${status.bg};color:${status.color};border:1px solid ${status.border};margin-bottom:18px;">
            ${status.label}
          </span>

          <p style="font-size:14px;line-height:1.7;color:#333;margin:0 0 12px;">${greeting}</p>
          <p style="font-size:14px;line-height:1.7;color:#333;margin:0 0 4px;">${intro}</p>

          ${detailsTable}
          ${reasonBlock}
          ${ctaButton}
          ${confirmButtons}

          <p style="font-size:14px;line-height:1.7;color:#333;margin-top:24px;">
            Regards,<br><strong>HR Team</strong><br>Brisk Olive
          </p>
        </div>

        <div style="background:#f8fafd;padding:16px 28px;border-top:1px solid #eef2f8;">
          <p style="margin:0;font-size:11px;color:#8a97ab;line-height:1.6;">
            This is an automated message from Brisk Olive HR regarding your interview process.
            Please do not reply directly to this email.
          </p>
        </div>

      </div>
    </div>
  `;

  return { subject, html };
}

module.exports = interviewRoundMailTemplate;
