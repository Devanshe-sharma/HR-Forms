// emails/senders/sendCandidateApplicationReceived.js
const fs   = require('fs');
const path = require('path');
const { sendMail } = require('../mailer');
const template      = require('../templates/candidateApplicationReceived');

const JD_DIR = path.join(__dirname, '..', '..', 'assets', 'job-descriptions');

function getJdAttachment(doc) {
  if (!doc.designation_id) return null;

  const jdPath = path.join(JD_DIR, `${doc.designation_id}.pdf`);
  if (!fs.existsSync(jdPath)) {
    console.warn(`[sendCandidateApplicationReceived] No JD found for designation_id ${doc.designation_id} at ${jdPath}`);
    return null;
  }

  return {
    filename: `${doc.designation} - Job Description.pdf`,
    path:     jdPath,
  };
}

async function sendCandidateApplicationReceived(doc) {
  const { subject, html } = template(doc);
  const jd = getJdAttachment(doc);

  await sendMail({
    from:        `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:          doc.email,
    subject,
    html,
    attachments: jd ? [jd] : [],
  });
}

module.exports = sendCandidateApplicationReceived;