// emails/senders/sendCandidateRejection.js
const { sendMail } = require('../mailer');
const template = require('../templates/candidateRejection');

async function sendCandidateRejection({ to, cc, candidateName, position, subjectOverride, customBody }) {
  const generated = template({ candidateName, position, customBody });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to,
    cc: cc || undefined,
    subject: subjectOverride || generated.subject,
    html: generated.html,
  });
}

module.exports = sendCandidateRejection;
