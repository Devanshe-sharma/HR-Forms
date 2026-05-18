const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("❌ Mailer auth failed:", err.message);
  } else {
    console.log("✅ Mailer ready —", process.env.GMAIL_USER);
  }
});

module.exports = transporter;