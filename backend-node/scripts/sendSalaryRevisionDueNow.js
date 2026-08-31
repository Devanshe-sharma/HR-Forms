// Manual trigger for the real Salary Revision due-this-quarter digest
// (backend-node/emails/senders/sendSalaryRevisionDue.js) — lets you test
// the actual production code path on demand, instead of waiting for the
// quarterly cron. Recipient is still routed to the developer only, per
// sendSalaryRevisionDue.js.
require('dotenv').config();

const mongoose = require('mongoose');
const sendSalaryRevisionDue = require('../emails/senders/sendSalaryRevisionDue');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await sendSalaryRevisionDue();
  console.log(`Sent — ${result.dueCount} employee(s) due this month.`);
}

main()
  .catch((err) => {
    console.error('Script failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
