const { sendMail } = require("../mailer");
const template = require("../templates/offerLetter");

async function sendOfferLetter({ to, full_name, joiningDate, uploadLink }) {
  const { subject, html } = template({ full_name, joiningDate, uploadLink });

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    subject,
    html,
  });
}

module.exports = sendOfferLetter;
