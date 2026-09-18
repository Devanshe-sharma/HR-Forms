const { sendMail } = require("../mailer");
const template    = require("../templates/welcomeAlreadyJoined");
const buildCc = require("../../utils/buildCc");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendWelcomeEmailAlreadyJoined(doc) {
  const { subject, html } = template(doc);

  // CC the joinee's own department (Role Master's group/head email) —
  // same lookup sendWelcomeEmail.js (the "Yet To Join" variant) uses.
  const deptEmail = await resolveDeptContactEmail(doc.dept);
  const cc = [buildCc(doc), deptEmail].filter(Boolean).join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      doc.persEmail,
    cc,
    subject, html,
  });
}

module.exports = sendWelcomeEmailAlreadyJoined;
