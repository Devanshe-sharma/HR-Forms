const formatDateIST = require("../utils/formatDateIST");

// "Intern" (including "Intern with PPO") gets the literal "internship"
// wording; every other contract-based category (currently just
// "Contract Based") gets "contract" instead, so a Contract Based hire
// isn't told their "internship" was extended.
function contractExtensionTemplate(doc) {
  const roleWord = doc.employeeCategory?.startsWith("Intern") ? "internship" : "contract";
  const months = doc.contractPeriod;
  const duration = months ? `${months} month${Number(months) === 1 ? "" : "s"}` : "extended";
  const startDate = formatDateIST(doc.contractStartDate) || "-";
  const endDate = formatDateIST(doc.contractEndDate) || "-";

  const html = `
    <p>Dear ${doc.name},</p>
    <p>We are pleased to inform you that your ${roleWord} with Brisk Olive has been extended for an additional ${duration} period, from ${startDate} to ${endDate}.</p>
    <p>We appreciate your contributions and efforts during your ${roleWord} so far and look forward to your continued learning and contribution to the team.</p>
    <p>All other terms and conditions of your ${roleWord} will remain unchanged unless communicated otherwise.</p>
    <p>We wish you continued success in your ${roleWord} and look forward to working with you.</p>
    <p>
      Best Regards,<br>
      HR Team<br>
      Brisk Olive
    </p>
  `;

  return {
    subject: `${roleWord === "internship" ? "Internship" : "Contract"} Extension: ${doc.name}`,
    html,
  };
}

module.exports = contractExtensionTemplate;
