// One-off script: re-sends the "New Joining" instructions-to-all email for
// one employee, now that sendInstructionsToAll.js's persEmail/email
// field-name bug is fixed. Matches the same employee lookup/send call the
// real onboarding-creation trigger uses (emails/triggers/
// triggerNewOnboarding.js) — just invoked manually instead of at creation
// time, since this one already went out once with the bug.
//
// Run on the server (needs real mail credentials):
//   cd /var/www/HR-Forms/backend-node
//   node scripts/resendNewJoiningMail.js "Anmol Jangra"
//
// Sends to the exact same wide distribution as the original (HR, DME,
// Admin, reporting manager, Accounts direct; Management + dept group CC)
// — everyone who got the first one gets this corrected one too.

require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('../models/onboardingModel');
const sendInstructionsToAll = require('../emails/senders/sendInstructionsToAll');

async function run() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: node scripts/resendNewJoiningMail.js "<Employee Name>"');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const doc = await Onboarding.findOne({ name: new RegExp(`^${name}$`, 'i') });
  if (!doc) {
    console.error(`No Onboarding record found matching "${name}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found: ${doc.name} | persEmail: ${doc.persEmail || '(blank)'} | dept: ${doc.dept} | designation: ${doc.designation}`);
  await sendInstructionsToAll(doc);
  console.log('Sent.');

  await mongoose.disconnect();
}

run().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
