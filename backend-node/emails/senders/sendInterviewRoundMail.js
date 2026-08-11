// emails/senders/sendInterviewRoundMail.js
const { sendMail } = require('../mailer');
const template = require('../templates/interviewRoundMail');

async function sendInterviewRoundMail({
  to, cc, type, audience, candidateName, position, round, cancellationReason, confirmLinks, feedbackLink,
  subjectOverride, customBody,
}) {
  // html is always freshly generated server-side (never taken raw from the
  // client) — HR can only override the subject and the plain-text body,
  // so the confirm-buttons/feedback-link blocks can never be broken or
  // dropped by a typo.
  const generated = template({ type, audience, candidateName, position, round, cancellationReason, confirmLinks, feedbackLink, customBody });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to,
    cc: cc || undefined,
    subject: subjectOverride || generated.subject,
    html: generated.html,
  });
}

module.exports = sendInterviewRoundMail;
