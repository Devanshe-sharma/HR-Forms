const { sendMail } = require('../mailer');
const template     = require('../templates/referralBonusEligible');

async function sendReferralBonusEligible(doc) {
  const { subject, html } = template(doc);

  const to = [doc.employeeEmail, process.env.ACCOUNTS_EMAIL || 'accounts@briskolive.com']
    .filter(Boolean).join(',');
  const cc = [process.env.HR_EMAIL, process.env.HR_HEAD_EMAIL, process.env.EMAIL_MANAGEMENT]
    .filter(Boolean).join(',');

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to, cc, subject, html,
  });
}

module.exports = sendReferralBonusEligible;
