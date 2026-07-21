const { sendMail } = require("../mailer");
const template    = require("../templates/employeeFeedback");
const buildCc = require("../../utils/buildCc");

async function sendEmployeeFeedback(doc) {
  // Goes to the employee being asked for their onboarding feedback —
  // the guard below already checked for persEmail (clearly the intended
  // recipient), but the actual send still used process.env.HR_EMAIL
  // instead of ever using it.
  if (!doc.persEmail) return;

  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      doc.persEmail,
    cc:      buildCc(doc),
    subject, html,
  });
}

module.exports = sendEmployeeFeedback;