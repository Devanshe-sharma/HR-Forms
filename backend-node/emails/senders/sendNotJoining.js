const { sendMail } = require("../mailer");
const notJoiningTemplate = require("../templates/notJoining");

async function sendNotJoining(doc) {
  const { subject, html } = notJoiningTemplate(doc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
    to:      process.env.HR_EMAIL,
    cc:      doc.employeesInCc?.join(",") || "",
    subject, html,
  });
}

module.exports = sendNotJoining;