// emails/senders/sendCandidateShortlisted.js
const { sendMail } = require('../mailer');
const template = require('../templates/candidateShortlisted');

// Same HR-team CC floor as sendCandidateSelection.js / sendCandidateRejection.js.
const DEFAULT_HR_CC = process.env.EMAIL_HR_TEAM || 'hr@briskolive.com';

async function sendCandidateShortlisted({ to, cc, candidateName, position, subjectOverride, customBody }) {
  const generated = template({ candidateName, position, customBody });

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

module.exports = sendCandidateShortlisted;
