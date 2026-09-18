const { sendMail } = require("../mailer");
const template    = require("../templates/employeeFeedback");
const buildCc = require("../../utils/buildCc");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendEmployeeFeedback(doc) {
  // Goes to the employee being asked for their onboarding feedback —
  // the guard below already checked for persEmail (clearly the intended
  // recipient), but the actual send still used process.env.HR_EMAIL
  // instead of ever using it.
  if (!doc.persEmail) return;

  const { subject, html } = template(doc);

  // CC the joinee's own department (Role Master's group/head email).
  const deptEmail = await resolveDeptContactEmail(doc.dept);
  const cc = [buildCc(doc), deptEmail].filter(Boolean).join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      doc.persEmail,
    cc,
    subject, html,
  });
}

module.exports = sendEmployeeFeedback;