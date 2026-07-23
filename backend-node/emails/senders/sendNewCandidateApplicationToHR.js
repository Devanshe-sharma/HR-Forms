const { sendMail } = require("../mailer");
const template      = require("../templates/newCandidateApplication");
const HiringRequisition = require("../../models/HiringRequisition");

async function sendNewCandidateApplicationToHR(doc) {
  
  const to = process.env.HR_EMAIL || 'hr.manager@briskolive.com,hr.head@briskolive.com';
  let jdLink = null;
  if (doc.job_id) {
    const requisition = await HiringRequisition.findOne({ serial_no: doc.job_id }).lean();
    jdLink = requisition?.jd_link || null;
  }

  const { subject, html } = template(doc, jdLink);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to,
    subject, html,
  });
}

module.exports = sendNewCandidateApplicationToHR;