const { sendMail } = require("../mailer");
const template    = require("../templates/employeeFeedback");
const buildCc = require("../../utils/buildCc");
async function sendEmployeeFeedback(doc) {
  if (!doc.persEmail) return;
  const { subject, html } = template(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.HR_EMAIL,
    cc:      buildCc(doc),
    subject, html,
  });
}

module.exports = sendEmployeeFeedback;
