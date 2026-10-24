const { sendMail } = require("../mailer");
const template = require("../templates/contractExtension");
const resolveEmployeeEmailByName = require("../../utils/resolveEmployeeEmailByName");

// Sent when HR adds/renews a contract period for an Intern / Contract Based
// joinee via the Update Onboarding page. Goes straight to the employee (not
// CC'd), with Accounts, Management, and their actual reporting manager CC'd
// — same manager-name-to-email resolution Instructions-to-All already uses.
//
// Split out from the actual send so the caller can show HR an editable
// preview (To/Cc/Subject/Body) before anything goes out — see
// routes/onboardingroutes.js's /:id/contract and /:id/contract/send-mail.
async function buildContractExtensionMail(doc) {
  const to = doc.officialEmail || doc.persEmail || '';

  const managerEmail = await resolveEmployeeEmailByName(doc.reportingHead, { preferDept: doc.dept });

  const cc = [process.env.ACCOUNTS_EMAIL, process.env.EMAIL_MANAGEMENT, managerEmail]
    .filter(Boolean)
    .join(",");

  const { subject, html } = template(doc);

  return { to, cc, subject, body: html };
}

async function sendContractExtension(doc) {
  const { to, cc, subject, body } = await buildContractExtensionMail(doc);
  if (!to) return;

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    cc,
    subject,
    html: body,
  });
}

module.exports = sendContractExtension;
module.exports.buildContractExtensionMail = buildContractExtensionMail;
