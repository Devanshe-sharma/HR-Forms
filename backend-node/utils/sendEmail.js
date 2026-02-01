const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Send email utility
 * @param {Object} options
 * @param {string} options.to - recipient email (can be comma-separated string)
 * @param {string} options.subject - email subject
 * @param {string} [options.text] - plain text version
 * @param {string} [options.html] - HTML version (recommended)
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"HR Training System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || 'No plain text version available',
      html: html || `<p>${text?.replace(/\n/g, '<br>') || 'No content'}</p>`,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully → Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return { success: false, error };
  }
};

module.exports = sendEmail;