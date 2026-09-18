// sendInstructionsToAllAlreadyJoined.js
const { sendMail } = require("../mailer");
const template     = require("../templates/instructionsToAllAlreadyJoined");
const buildCc      = require("../../utils/buildCc");
const resolveDeptContactEmail = require("../../utils/resolveDeptContactEmail");

async function sendInstructionsToAllAlreadyJoined(doc) {
  const { subject, html } = template(doc);

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
