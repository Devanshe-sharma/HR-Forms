function formatDate(d) {
  if (!d) return 'To be confirmed';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Solid colors only (no gradients) — Outlook desktop's Word rendering engine
// drops CSS gradients silently, so a solid brand color is the safe choice
// for a banner background that has to render the same everywhere.
const STATUS_STYLE = {
  schedule:   { label: 'Scheduled',   bg: '#e3f2fd', color: '#0d47a1', border: '#1976d2' },
  reschedule: { label: 'Rescheduled', bg: '#fff8e1', color: '#e65100', border: '#ffa000' },
  cancel:     { label: 'Cancelled',   bg: '#fce4ec', color: '#880e4f', border: '#e91e63' },
};

// The plain-text body HR actually sees and edits — greeting, a short
// intro sentence, the round details as plain "Label: value" lines, and a
// sign-off. No markup at all, so editing it can never break anything.
function buildDefaultBody({ type, audience, candidateName, position, round, cancellationReason }) {
  const stage = round.stage || 'Interview';
  const date  = formatDate(round.scheduledDate);
  const time  = round.scheduledTime || 'To be confirmed';
  const mode  = round.mode || 'To be decided';
  const link  = round.meetingLink || '[Address/Link]';

  const greeting = audience === 'interviewer' ? 'Dear Interviewer,' : `Dear ${candidateName},`;

  let intro;
  if (type === 'cancel') {
    intro = audience === 'interviewer'
      ? 'This is to inform you that the following interview has been cancelled.'
      : 'We regret to inform you that your interview has been cancelled. Our team will get in touch regarding next steps.';
  } else if (type === 'reschedule') {
    intro = audience === 'interviewer'
      ? 'The interview below has been rescheduled. Please find the updated details:'
      : `Your interview for the role of ${position} has been rescheduled. Please find the updated details below:`;
  } else {
    intro = audience === 'interviewer'
      ? 'You have been scheduled to interview the candidate below:'
      : `We are pleased to inform you that your interview has been scheduled for the role of ${position}. Please find the details below:`;
  }

  const lines = [greeting, '', intro, ''];

  if (audience === 'interviewer') {
    lines.push(`Candidate: ${candidateName}`, `Position: ${position}`);
  }

  if (type !== 'cancel') {
    lines.push(
      `Round: ${stage}`,
      `Date: ${date}`,
      `Time: ${time}`,
      `Mode: ${mode}`,
      `Location/Meeting Link: ${link}`,
    );
  }

  if (type === 'cancel' && audience === 'interviewer' && cancellationReason) {
    lines.push('', `Reason: ${cancellationReason}`);
  }

  lines.push('', 'Regards,', 'HR Team', 'Brisk Olive');

  return lines.join('\n');
}

// type: 'schedule' | 'reschedule' | 'cancel'
// audience: 'interviewer' | 'candidate'
// confirmLinks: { yes, maybe, no } — full URLs to the public /respond
// endpoint, only meaningful for schedule/reschedule mails sent to the
// candidate. "Can't attend" doesn't record anything on click — it opens a
// short reason form first (see routes/applicantRecords.js). These stay a
// fixed, non-editable addition below the body — they carry signed tokens
// generated server-side, not something HR should hand-type.
// feedbackLink: URL to the interviewer's feedback form (candidate details +
// JD, a recommendation-status dropdown, and a feedback textarea) — only
// meaningful for the interviewer's schedule/reschedule mail, same
// fixed/non-editable treatment as confirmLinks.
// customBody: optional plain-text override for the entire message,
// straight from the "Edit & Send Mail" dashboard popup.
function interviewRoundMailTemplate({ type, audience, candidateName, position, round, cancellationReason, confirmLinks, feedbackLink, customBody }) {
  const status = STATUS_STYLE[type];

  const subject = audience === 'interviewer'
    ? `Interview ${status.label} — ${candidateName} (${position}) — ${round.stage || 'Interview'}`
    : `Your Interview has been ${status.label} — ${position}`;

  const defaultBody = buildDefaultBody({ type, audience, candidateName, position, round, cancellationReason });
  const body = (customBody && customBody.trim()) ? customBody.trim() : defaultBody;

  const bodyHtml = body
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br>' : `<p style="font-size:14px;line-height:1.7;color:#333;margin:0 0 4px;">${escapeHtml(line)}</p>`))
    .join('');

  const confirmButtons = (type !== 'cancel' && audience === 'candidate' && confirmLinks)
    ? `
      <div style="margin:20px 0 4px;">
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

  const feedbackButton = (type !== 'cancel' && audience === 'interviewer' && feedbackLink)
    ? `
      <p style="text-align:center;margin:24px 0 4px;">
        <a href="${feedbackLink}" style="display:inline-block;background:#1a3e72;color:#ffffff;padding:12px 28px;
          text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">
          Submit Interview Feedback
        </a>
      </p>
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

          ${bodyHtml}
          ${confirmButtons}
          ${feedbackButton}
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

  return { subject, body, html };
}

module.exports = interviewRoundMailTemplate;
