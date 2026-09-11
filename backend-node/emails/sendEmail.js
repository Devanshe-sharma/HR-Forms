const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
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
 * @param {string} [options.cc] - Cc recipient(s), comma-separated
 * @param {string} [options.bcc] - Bcc recipient(s), comma-separated
 * @returns {Promise<{success: boolean, messageId?: string, error?: any}>}
 */
const sendEmail = async ({ to, subject, text, html, cc, bcc }) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.GMAIL_FROM || `"HR System" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: text || 'No plain text version available',
      html: html || `<p>${text?.replace(/\n/g, '<br>') || 'No content'}</p>`,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully  Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return { success: false, error };
  }
};

module.exports = sendEmail;
