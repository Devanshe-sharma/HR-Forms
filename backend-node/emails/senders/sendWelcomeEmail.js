const { sendMail } = require("../mailer");
const template    = require("../templates/welcomeYetToJoin");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendWelcomeEmail(doc) {
  if (!doc.persEmail) return;
  const { subject, html } = template(doc);

  // CC the joinee's own department (Role Master's dept group/head email)
  // and Management, so both know a new hire has been welcomed — the
  // "Already Joined" welcome variant already did this via buildCc(); this
  // one previously went to the candidate only, with nobody else copied.
  const deptEmail = await resolveDeptContactEmail(doc.dept);
  const cc = [deptEmail, process.env.EMAIL_MANAGEMENT, ...(doc.employeesInCc || [])]
    .filter(Boolean)
    .join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      doc.persEmail,
    cc,
    subject, html,
  });
}

module.exports = sendWelcomeEmail;