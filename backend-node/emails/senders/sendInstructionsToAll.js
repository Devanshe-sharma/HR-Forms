// sendInstructionsToAll.js
const { sendMail } = require("../mailer");
const template     = require("../templates/instructionsToAll");
const resolveEmployeeEmailByName = require("../../utils/resolveEmployeeEmailByName");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendInstructionsToAll(doc) {
  const { subject, html } = template(doc);

  // Concerned departments get this directly (not CC'd): HR, DME, Admin,
  // this joinee's Reporting/Department Manager (doc.reportingHead is a
  // plain name, resolved to an email the same way Salary Revision's
  // manager-escalation emails do — see resolveEmployeeEmailByName.js),
  // and Accounts. Management is CC-only, per HR's requested recipient
  // split for this email — plus any ad hoc names HR added to the record's
  // own CC list, plus the joinee's own department group email (Role
  // Master), which may not be the same inbox as the reporting manager.
  const reportingManagerEmail = await resolveEmployeeEmailByName(doc.reportingHead, { preferDept: doc.dept });
  const deptEmail = await resolveDeptContactEmail(doc.dept);

  const to = [
    process.env.HR_HEAD_EMAIL,
    process.env.EMAIL_DME_TEAM,
    process.env.EMAIL_ADMIN_TEAM,
    reportingManagerEmail,
    process.env.ACCOUNTS_EMAIL,
  ].filter(Boolean).join(",");

  const cc = [process.env.EMAIL_MANAGEMENT, deptEmail, ...(doc.employeesInCc || [])]
    .filter(Boolean)
    .join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    cc,
    subject, html,
  });
}

module.exports = sendInstructionsToAll;
