const signature = require("../utils/signature");

function candidateApplicationReceivedTemplate(doc) {
  const html = `
    <p>Dear ${doc.full_name},</p>
    <p>
      Thank you for applying to Brisk Olive Business Solutions Pvt. Ltd.
      We've received your application for the <b>${doc.designation}</b> position.
      Our team will review your profile and get in touch if you're shortlisted.
    </p>
    <p>Please find attached the Job Description for your reference.</p>
    <p>
      You can also learn more about us at
      <a href="https://www.briskolive.com">www.briskolive.com</a>.
    </p>
    ${signature()}
  `;
  return {
    subject: `Application Received – ${doc.designation}`,
    html,
  };
}

module.exports = candidateApplicationReceivedTemplate;
