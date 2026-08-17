function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildDefaultBody({ candidateName }) {
  return [
    `Hello ${candidateName},`,
    '',
    'Thank you for your interest in Brisk Olive Business Solutions Pvt. Ltd. and for taking the time to interview with us.',
    '',
    'While we were impressed with your background, we have decided to move forward with other candidates whose profiles are more closely aligned with our current requirements at this time.',
    '',
    'We truly appreciate your time and effort, and we encourage you to apply for future opportunities that match your skills and experience.',
    '',
    'We wish you all the very best in your future endeavors...!!',
    '',
    'Regards,',
    'HR Team',
    'Brisk Olive Business Solutions Pvt. Ltd.',
  ].join('\n');
}

// customBody: optional plain-text override for the entire message, from
// the same "Edit & Send Mail" style popup used for interview round mails.
function candidateRejectionTemplate({ candidateName, position, customBody }) {
  const subject = `Update on your application — ${position}`;

  const defaultBody = buildDefaultBody({ candidateName, position });
  const body = (customBody && customBody.trim()) ? customBody.trim() : defaultBody;

  const bodyHtml = body
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br>' : `<p style="font-size:14px;line-height:1.7;color:#333;margin:0 0 4px;">${escapeHtml(line)}</p>`))
    .join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#f4f6fa;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4eaf4;">

        <div style="background:#1a3e72;padding:24px 28px;">
          <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.75;">Brisk Olive HR</p>
          <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Application Update</h2>
        </div>

        <div style="padding:28px;">
          ${bodyHtml}
        </div>

        <div style="background:#f8fafd;padding:16px 28px;border-top:1px solid #eef2f8;">
          <p style="margin:0;font-size:11px;color:#8a97ab;line-height:1.6;">
            This is an automated message from Brisk Olive HR regarding your application.
            Please do not reply directly to this email.
          </p>
        </div>

      </div>
    </div>
  `;

  return { subject, body, html };
}

module.exports = candidateRejectionTemplate;
