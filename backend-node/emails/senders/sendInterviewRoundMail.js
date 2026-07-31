// emails/senders/sendInterviewRoundMail.js
const { sendMail } = require('../mailer');
const template = require('../templates/interviewRoundMail');

async function sendInterviewRoundMail({ to, type, audience, candidateName, position, round, cancellationReason, confirmLinks }) {
  const { subject, html } = template({ type, audience, candidateName, position, round, cancellationReason, confirmLinks });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = sendInterviewRoundMail;
