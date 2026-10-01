// sendInstructionsToAllAlreadyJoined.js
const { sendMail } = require("../mailer");
const template     = require("../templates/instructionsToAllAlreadyJoined");
const buildCc      = require("../../utils/buildCc");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendInstructionsToAllAlreadyJoined(doc) {
  // Same field-name mismatch as sendInstructionsToAll.js — the template's
  // `email` param means the joinee's PERSONAL email, but Onboarding has no
  // `email` field (it's `persEmail`), so passing `doc` straight through
  // always rendered a blank "Personal Email" regardless of what's on file.
  const { subject, html } = template({
    name: doc.name,
    email: doc.persEmail,
    mobile: doc.mobile,
    dept: doc.dept,
    deptLink: doc.deptLink,
    designation: doc.designation,
    designationLink: doc.designationLink,
    joinedDate: doc.joinedDate,
  });

  // CC the joinee's own department (Role Master's group/head email).
  const deptEmail = await resolveDeptContactEmail(doc.dept);
  const cc = [buildCc(doc, process.env.ALL_EMAIL), deptEmail].filter(Boolean).join(",");

  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.ALL_EMAIL,
    cc,
    subject, html,
  });
}

module.exports = sendInstructionsToAllAlreadyJoined;
