function candidateApplicationReceivedTemplate(doc, jdLink) {
  const html = `
    <p>Dear ${doc.full_name},</p>
    <p>
      Thank you for applying to Brisk Olive Business Solutions Pvt. Ltd.
      We've received your application for the <b>${doc.designation}</b> position.
      Our team will review your profile and get in touch if you're shortlisted.
    </p>
    ${jdLink ? `<p>You can view the full Job Description here: <a href="${jdLink}" target="_blank">${jdLink}</a></p>` : ""}
    <p>
      You can also learn more about us at
      <a href="https://www.briskolive.com">www.briskolive.com</a>.
    </p>
    <p>HR Team<br>Brisk Olive</p>
  `;
  return {
    subject: `Application Received – ${doc.designation}`,
    html,
  };
}

module.exports = candidateApplicationReceivedTemplate;