// emails/senders/sendInterviewRoundMail.js
const { sendMail } = require('../mailer');
const template = require('../templates/interviewRoundMail');

// HR team is always on CC, regardless of what the dashboard's "Edit & Send
// Mail" popup sent — that's just a pre-filled default HR can add to, not a
// gate, so this floor is the actual guarantee.
const DEFAULT_HR_CC = process.env.EMAIL_HR_TEAM || 'hr@briskolive.com';

async function sendInterviewRoundMail({
  to, cc, type, audience, candidateName, position, round, cancellationReason, confirmLinks, feedbackLink,
  subjectOverride, customBody,
}) {
  // html is always freshly generated server-side (never taken raw from the
  // client) — HR can only override the subject and the plain-text body,
  // so the confirm-buttons/feedback-link blocks can never be broken or
  // dropped by a typo.
  const generated = template({ type, audience, candidateName, position, round, cancellationReason, confirmLinks, feedbackLink, customBody });

  const ccList = [...(cc ? cc.split(',') : []), DEFAULT_HR_CC].map((s) => s.trim()).filter(Boolean);
  const dedupedCc = [...new Set(ccList)].join(',');

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to,
    cc: dedupedCc,
    subject: subjectOverride || generated.subject,
    html: generated.html,
  });
}

module.exports = sendInterviewRoundMail;
