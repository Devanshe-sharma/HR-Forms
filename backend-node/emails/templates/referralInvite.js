const signature = require('../utils/signature');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

// Sent company-wide whenever a hiring requisition is HR-approved — asks
// everyone to refer candidates for the newly opened role via a short
// public form, linked here.
function referralInviteTemplate(doc) {
  const referLink = `${FRONTEND_URL}/refer/${doc._id}`;

  const html = `
    <p>Dear All,</p>
    <p>We're hiring for the position below, and would love your referrals!</p>
    <ul>
      <li>Designation: <b>${doc.designation || '—'}</b></li>
      <li>Department: <b>${doc.hiring_dept || '—'}</b></li>
      <li>Experience Level: <b>${doc.candidate_experience_level || '—'}</b></li>
      ${doc.base_location ? `<li>Location: <b>${doc.base_location}</b></li>` : ''}
      ${doc.required_skills?.length ? `<li>Key Skills: <b>${doc.required_skills.join(', ')}</b></li>` : ''}
      ${doc.jd_link ? `<li><a href="${doc.jd_link}" target="_blank">View Job Description</a></li>` : ''}
      ${doc.role_link ? `<li><a href="${doc.role_link}" target="_blank">View Role Details</a></li>` : ''}
    </ul>
    <p>If you know someone who'd be a great fit, please share their details here — it only takes a minute:</p>
    <p><a href="${referLink}" target="_blank" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Refer a Candidate</a></p>
    <p>Thank you for helping us grow the team!</p>
    ${signature()}
  `;

  return {
    subject: `Know someone excellent for our ${doc.designation || 'open'} role? Refer & Earn Referral Bonus + our Gratitude!`,
    html,
  };
}

module.exports = referralInviteTemplate;
