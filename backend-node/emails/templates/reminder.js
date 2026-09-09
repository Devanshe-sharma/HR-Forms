const signature = require("../utils/signature");
const formatDateIST = require("../utils/formatDateIST");
const resolveWorkLocation = require("../utils/resolveWorkLocation");

function reminderTemplate({ name, designation, dept, reportingHead, plannedJoiningDate }) {
  const date = formatDateIST(plannedJoiningDate) || "Pending";
  const jobLocation = resolveWorkLocation(dept);

  const html = `
    <p>Dear ${name},</p>
    <p>Greetings from Brisk Olive Business Solutions Pvt. Ltd.</p>
    <p>This is a gentle reminder that your joining with us is scheduled for tomorrow, <b>${date}</b>.</p>

    <p>Please find your joining details below:</p>
    <ul>
      <li>Designation: ${designation || "-"}</li>
      <li>Department: ${dept || "-"}</li>
      <li>Reporting Manager: ${reportingHead || "-"}</li>
      <li>Reporting Time: 9 AM</li>
      <li>Work Location: ${jobLocation || "-"}</li>
    </ul>

    <p>We look forward to welcoming you to the Brisk Olive team.</p>
    <p>If you have any questions or need any assistance before joining, please feel free to reach out to the HR Team.</p>
    ${signature()}
  `;
  return {
    subject: `Reminder: Your Joining with Brisk Olive Tomorrow, ${date}`,
    html,
  };
}

module.exports = reminderTemplate;
