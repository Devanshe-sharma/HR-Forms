const signature = require('../utils/signature');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';
const REFERRALS_DASHBOARD_LINK = `${FRONTEND_URL}/referrals`;

// Sent to HR whenever an employee submits a referral through the public
// /refer/:requisitionId form.
function referralSubmittedTemplate(doc) {
  const html = `
    <p>Dear HR,</p>
    <p>A new candidate has been referred:</p>
    <ul>
      <li>Position: <b>${doc.designation || '—'}</b> (${doc.hiring_dept || '—'})</li>
      <li>Referred by: <b>${doc.referrerName}</b> (${doc.referrerEmail})</li>
      <li>Candidate: <b>${doc.candidateName}</b></li>
      <li>Phone: <b>${doc.candidatePhone}</b></li>
      <li>Email: <b>${doc.candidateEmail}</b></li>
      ${doc.relationship ? `<li>Relationship to referrer: <b>${doc.relationship}</b></li>` : ''}
      <li>Resume: <a href="${doc.resume}" target="_blank">View Resume</a></li>
    </ul>
    <p><a href="${REFERRALS_DASHBOARD_LINK}" target="_blank">Open Referrals Dashboard</a></p>
    ${signature()}
  `;

  return {
    subject: `New Referral: ${doc.candidateName} for ${doc.designation || '?'}`,
    html,
  };
}

module.exports = referralSubmittedTemplate;
