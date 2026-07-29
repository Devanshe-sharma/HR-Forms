require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const id = '6a41e8e005a36d95f3b01496';
  const contractHistory = [
    { startDate: new Date('2023-08-24T00:00:00.000Z'), endDate: new Date('2024-08-23T23:59:59.999Z') },
    { startDate: new Date('2024-08-24T00:00:00.000Z'), endDate: new Date('2025-08-23T23:59:59.999Z') },
    { startDate: new Date('2025-08-24T00:00:00.000Z'), endDate: null },
  ];
  const result = await Onboarding.updateOne(
    { _id: id },
    {
      $set: {
        contractStartDate: new Date('2025-08-24T00:00:00.000Z'),
        contractEndDate: null,
        contractAmount: 1409764,
        contractPeriod: 12,
        contractHistory,
      },
    }
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