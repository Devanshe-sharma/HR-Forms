const nodemailer = require("nodemailer");

const TEST_MODE = true;

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

// FORCE ALL EMAILS TO TEST INBOX
async function sendMail(options) {
  const finalOptions = TEST_MODE
    ? {
        ...options,

        to: "software.developer@briskolive.com",

        cc: "dataanalytics.manager@briskolive.com",

        bcc: undefined,
      }
    : options;

  console.log("\n📧 EMAIL DEBUG");
  console.log("TO :", finalOptions.to);
  console.log("CC :", finalOptions.cc);
  console.log("SUBJECT :", finalOptions.subject);

  return transporter.sendMail(finalOptions);
}

module.exports = {
  transporter,
  sendMail,
};