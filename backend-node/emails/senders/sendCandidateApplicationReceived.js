// emails/senders/sendCandidateApplicationReceived.js
const { sendMail } = require('../mailer');
const template = require('../templates/candidateApplicationReceived');
const HiringRequisition = require('../../models/HiringRequisition');

// Previously tried to attach a local PDF file from
// assets/job-descriptions/{designation_id}.pdf — that folder was never
// populated anywhere in this codebase, so every single send silently
// found nothing and attached no JD at all. Every other JD reference in
// this app (the requisition itself, the Dept & Designation Master, the
// HR-facing candidate notification) uses a live Google Drive link
// instead — this now does the same: looks up the matching requisition
// by job_id (== HiringRequisition.serial_no) and links to its jd_link
// directly in the email body, rather than attaching a file that was
// never actually stored anywhere.
async function sendCandidateApplicationReceived(doc) {
  let jdLink = null;
  if (doc.job_id) {
    const requisition = await HiringRequisition.findOne({ serial_no: doc.job_id }).lean();
    jdLink = requisition?.jd_link || null;
  }

  const { subject, html } = template(doc, jdLink);

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:   doc.email,
    subject,
    html,
  });
}

module.exports = sendCandidateApplicationReceived;