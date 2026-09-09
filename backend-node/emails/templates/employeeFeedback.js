const signature = require("../utils/signature");
const formatDateIST = require("../utils/formatDateIST");

const FEEDBACK_FORM_LINK = "https://forms.gle/2p5rcR8Rz4p2M53e8";

// HR triggers this manually (employeeConfirmationEmail checkbox) anywhere
// from 15 to 30 days after joining — there's no fixed send-day here, only
// a response window once it IS sent: 7 days from whenever that happens.
const FEEDBACK_RESPONSE_WINDOW_DAYS = 7;

function employeeFeedbackTemplate({ name }) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + FEEDBACK_RESPONSE_WINDOW_DAYS);

  const html = `
    <p>Dear ${name},</p>
    <p>We hope your onboarding experience at Brisk Olive Business Solutions Pvt. Ltd. has been smooth and comfortable.</p>
    <p>As part of our continuous effort to improve the onboarding experience, we request you to take a few minutes to complete the New Joiner Feedback Form. Your feedback will help us understand what worked well and identify areas where we can improve.</p>
    <p><a target="_blank" href="${FEEDBACK_FORM_LINK}">Feedback Form Link</a></p>
    <p>We request you to complete the form by <b>${formatDateIST(deadline)}</b>.</p>
    <p>Thank you for your time and valuable feedback.</p>
    ${signature()}
  `;
  return {
    subject: "New Joiner Feedback Form - Your Feedback Matters!",
    html,
  };
}

module.exports = employeeFeedbackTemplate;
