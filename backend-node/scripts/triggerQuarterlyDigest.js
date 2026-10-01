// One-off script: manually fires the quarterly "Salary Revision Due"
// digest right now, instead of waiting for its scheduled cron time
// (9am on the 1st of Apr/Jul/Oct/Jan — see emails/scheduler.js). Queues
// the Management-wide digest AND one per manager (see
// emails/senders/sendSalaryRevisionDue.js) as drafts — nothing is sent
// automatically; they land in the Company Mail button on the Salary
// Revision page for HR to review and send.
//
// Run on the server, AFTER deploying the latest code (git pull + restart
// hr-backend) — otherwise this regenerates the same stale numbers the
// scheduled run already produced:
//   cd /var/www/HR-Forms/backend-node
//   node scripts/triggerQuarterlyDigest.js
//
// Safe to re-run — queues a fresh draft each time rather than editing an
// existing one, so if you run it twice you'll get two drafts; discard the
// older one from the Company Mail button before sending.

require('dotenv').config();
const mongoose = require('mongoose');
const sendSalaryRevisionDue = require('../emails/senders/sendSalaryRevisionDue');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const result = await sendSalaryRevisionDue();
  console.log('Quarterly digest queued:', JSON.stringify(result));
  await mongoose.disconnect();
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
