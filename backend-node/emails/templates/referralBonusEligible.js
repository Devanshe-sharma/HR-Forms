const signature = require('../utils/signature');

// Sent once a joinee's confirmation is finalised as 'confirmed' — only when
// they were tagged as referred (at Onboarding) and were never placed on PIP
// (never passed through an 'extended' confirmation status) and have crossed
// 6 months' tenure. Combines a congratulations to the joinee with the
// payable-bonus notice to Accounts, so nobody has to chase the bonus.
function referralBonusEligibleTemplate(doc) {
  const html = `
    <p>Dear ${doc.employeeName || 'Team'},</p>
    <p>Congratulations on successfully completing your probation period and being <b>confirmed</b> at Brisk Olive! We're glad to have you with us.</p>

    <hr style="border:none; border-top:1px solid #e2e8f0; margin:16px 0;">

    <p><b>For Accounts — Referral Bonus Payable</b></p>
    <p>The employee below has been confirmed after completing the minimum 6-month tenure, without having been placed on PIP, and was hired via an employee referral. As per policy, a <b>Rs. 5,000 referral bonus</b> is now payable to the referrer.</p>
    <ul>
      <li>Confirmed Employee: <b>${doc.employeeName || '—'}</b></li>
      <li>Department: <b>${doc.department || '—'}</b></li>
      <li>Designation: <b>${doc.designation || '—'}</b></li>
      <li>Joining Date: <b>${doc.joiningDate || '—'}</b></li>
      <li>Referred By: <b>${doc.referredByName || '—'}</b>${doc.referredByEmail ? ` (${doc.referredByEmail})` : ''}</li>
    </ul>
    <p>Please process the referral bonus at the earliest.</p>
    ${signature()}
  `;

  return {
    subject: `Referral Bonus Payable — ${doc.employeeName || 'Employee'} Confirmed`,
    html,
  };
}

module.exports = referralBonusEligibleTemplate;
