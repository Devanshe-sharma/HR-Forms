require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await Onboarding.updateOne(
    { name: 'Sandeep Kumar Singh' },
    { $set: { contractStartDate: null, contractEndDate: null, contractAmount: null, contractPeriod: null, contractHistory: [] } }
  );
  console.log('modifiedCount:', result.modifiedCount, 'matchedCount:', result.matchedCount);
  const doc = await Onboarding.findOne({ name: 'Sandeep Kumar Singh' }).lean();
  console.log(JSON.stringify(doc ? {
    _id: doc._id,
    name: doc.name,
    officialEmail: doc.officialEmail,
    contractStartDate: doc.contractStartDate,
    contractEndDate: doc.contractEndDate,
    contractAmount: doc.contractAmount,
    contractPeriod: doc.contractPeriod,
    contractHistory: doc.contractHistory,
  } : { found: false }, null, 2));
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
