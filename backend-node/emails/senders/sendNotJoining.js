const { sendMail } = require("../mailer");
const notJoiningTemplate = require("../templates/notJoining");
const buildCc = require("../../utils/buildCc");
async function sendNotJoining(doc) {
  const { subject, html } = notJoiningTemplate(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.HR_EMAIL,
    cc:      buildCc(doc),
    subject, html,
  });
}

module.exports = sendNotJoining;
