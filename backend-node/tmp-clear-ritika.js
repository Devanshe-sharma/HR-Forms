require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const id = '6a41e8e005a36d95f3b01496';
  const result = await Onboarding.updateOne(
    { _id: id },
    { $set: { contractStartDate: null, contractEndDate: null, contractAmount: null, contractPeriod: null, contractHistory: [] } }
  );
  console.log('modifiedCount:', result.modifiedCount, 'matchedCount:', result.matchedCount);
  const doc = await Onboarding.findById(id).lean();
  console.log(JSON.stringify({
    _id: doc._id,
    name: doc.name,
    officialEmail: doc.officialEmail,
    contractStartDate: doc.contractStartDate,
    contractEndDate: doc.contractEndDate,
    contractAmount: doc.contractAmount,
    contractPeriod: doc.contractPeriod,
    contractHistory: doc.contractHistory,
  }, null, 2));
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});