require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await Onboarding.find({
    $or: [
      { name: /rit/i },
      { officialEmail: /rit/i },
      { persEmail: /rit/i },
    ],
  }).lean();
  console.log('count', docs.length);
  docs.forEach(doc => {
    console.log(JSON.stringify({
      _id: doc._id,
      name: doc.name,
      officialEmail: doc.officialEmail,
      persEmail: doc.persEmail,
      contractStartDate: doc.contractStartDate,
      contractEndDate: doc.contractEndDate,
      contractHistory: doc.contractHistory,
    }, null, 2));
  });
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});