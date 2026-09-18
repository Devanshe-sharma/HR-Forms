const { sendMail } = require("../mailer");
const template    = require("../templates/onboardingUpdate");
const buildCc = require("../../utils/buildCc");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendOnboardingUpdate(doc) {
  const { subject, html } = template(doc);

  // CC the joinee's own department (Role Master's group/head email).
  const deptEmail = await resolveDeptContactEmail(doc.dept);
  const cc = [buildCc(doc), deptEmail].filter(Boolean).join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.HR_EMAIL,
    cc,
    subject, html,
  });
}

module.exports = sendOnboardingUpdate;
