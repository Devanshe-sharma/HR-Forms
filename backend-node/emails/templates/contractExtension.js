const formatDateIST = require("../utils/formatDateIST");

// "Intern" (including "Intern with PPO") gets the literal "internship"
// wording; every other contract-based category (currently just
// "Contract Based") gets "contract" instead, so a Contract Based hire
// isn't told their "internship" was extended.
function contractExtensionTemplate(doc) {
  const roleWord = doc.employeeCategory?.startsWith("Intern") ? "internship" : "contract";
  const letterWord = roleWord === "internship" ? "Internship Letter" : "Contract";
  const firstName = (doc.name || "").trim().split(/\s+/)[0] || doc.name;
  const startDate = formatDateIST(doc.contractStartDate) || "-";
  const endDate = formatDateIST(doc.contractEndDate) || "-";

  const row = (label, value) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold;">${label}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;">${value || "-"}</td>
    </tr>`;

  const html = `
    <p>Dear ${firstName},</p>
    <p>We are pleased to inform you that your ${roleWord} with Brisk Olive Business Solutions Pvt. Ltd. has been extended.</p>
    <p>The revised ${roleWord} details are as follows:</p>
    <table style="border-collapse:collapse;width:100%;max-width:520px;">
      <thead>
        <tr>
          <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;background:#f4f4f4;">Particulars</th>
          <th style="padding:6px 12px;border:1px solid #ddd;text-align:left;background:#f4f4f4;">Details</th>
        </tr>
      </thead>
      <tbody>
        ${row("Name", doc.name)}
        ${row("Designation", doc.designation)}
        ${row("Department", doc.dept)}
        ${row("Extended Period", `${startDate} to ${endDate}`)}
        ${row("Reporting Manager", doc.reportingHead)}
        ${row("Location", doc.officeLocation)}
      </tbody>
    </table>
    <p>All other terms and conditions of your existing ${letterWord} shall remain unchanged unless otherwise communicated in writing.</p>
    <p>We appreciate your continued efforts and contribution to the team and look forward to your continued association with Brisk Olive.</p>
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
