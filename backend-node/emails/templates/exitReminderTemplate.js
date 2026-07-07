const signature = require("../utils/signature");

function exitReminderTemplate(doc, dateStr) {
  const html = `
    <p>Dear ${doc.name},</p>
    <p>As planned, a reminder to complete your Pre-Exit Formalities before ${dateStr}.</p>
    <p>I hope pre-exit actions are already completed - to ensure a smooth exit (the list is given in my earlier email).</p>
    <p>Please reach out to me if you have any queries.</p>
    ${signature()}
  `;
  return {
    subject: `Hi ${doc.name}, A Reminder to complete your Pre-Exit Formalities`,
    html,
  };
}

module.exports = exitReminderTemplate;
