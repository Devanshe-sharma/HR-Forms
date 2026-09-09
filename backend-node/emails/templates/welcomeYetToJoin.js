const signature = require("../utils/signature");
const formatDateIST = require("../utils/formatDateIST");
const resolveWorkLocation = require("../utils/resolveWorkLocation");

function welcomeYetToJoinTemplate({ name, designation, dept, reportingHead, plannedJoiningDate }) {
  const date = formatDateIST(plannedJoiningDate) || "Pending";
  const jobLocation = resolveWorkLocation(dept);

  const html = `
    <p>Dear ${name},</p>
    <p>Welcome to Brisk Olive Business Solutions Pvt. Ltd.!</p>
    <p>We are delighted to have you join our team and look forward to your contribution to our growing organization. We hope your journey with Brisk Olive will be enriching, rewarding, and full of opportunities to learn and grow.</p>

    <p><b>Your Joining Details:</b></p>
    <ul>
      <li>Designation: ${designation || "-"}</li>
      <li>Department: ${dept || "-"}</li>
      <li>Reporting Manager: ${reportingHead || "-"}</li>
      <li>Date of Joining: ${date}</li>
      <li>Work Location: ${jobLocation || "-"}</li>
    </ul>

    <p>On your first day, the HR team will assist you with the onboarding process, the necessary documentation, introduction to HR policies, and other formalities.</p>
    <p>Please ensure that you carry/submit any pending documents required for completion of your joining formalities.</p>
    <p>Once again, a very warm welcome to Brisk Olive! We are excited to have you as a part of our team and wish you a successful and fulfilling journey with us.</p>
    ${signature()}
  `;
  return {
    subject: `Welcome to Brisk Olive Business Solutions Pvt. Ltd., ${name}!`,
    html,
  };
}

module.exports = welcomeYetToJoinTemplate;
