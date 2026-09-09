const { sendMail } = require("../mailer");
const template = require("../templates/contractExtension");
const resolveEmployeeEmailByName = require("../../utils/resolveEmployeeEmailByName");

// Sent when HR adds/renews a contract period for an Intern / Contract Based
// joinee via the Update Onboarding page. Goes straight to the employee (not
// CC'd), with Accounts, Management, and their actual reporting manager CC'd
// — same manager-name-to-email resolution Instructions-to-All already uses.
async function sendContractExtension(doc) {
  const to = doc.officialEmail || doc.persEmail;
  if (!to) return;

  const managerEmail = await resolveEmployeeEmailByName(doc.reportingHead, { preferDept: doc.dept });

  const cc = [process.env.ACCOUNTS_EMAIL, process.env.EMAIL_MANAGEMENT, managerEmail]
    .filter(Boolean)
    .join(",");

  const { subject, html } = template(doc);

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    cc,
    subject,
    html,
  });
}

module.exports = sendContractExtension;
