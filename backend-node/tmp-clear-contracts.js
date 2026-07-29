require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');

const names = [
  'Divyansh',
  'Rirtika',
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const name of names) {
    console.log('\nProcessing:', name);
    const docs = await Onboarding.find({ name: new RegExp('^' + name + '$', 'i') }).lean();
    if (!docs.length) {
      console.log('No exact match found for', name);
      continue;
    }
    for (const doc of docs) {
      console.log('Found:', doc._id, doc.name, doc.officialEmail);
      const result = await Onboarding.updateOne(
        { _id: doc._id },
        { $set: { contractStartDate: null, contractEndDate: null, contractAmount: null, contractPeriod: null, contractHistory: [] } }
      );
      console.log('  updated:', result.modifiedCount === 1 ? 'yes' : 'no');
      const fresh = await Onboarding.findById(doc._id).lean();
      console.log(JSON.stringify({
        _id: fresh._id,
        name: fresh.name,
        officialEmail: fresh.officialEmail,
        contractStartDate: fresh.contractStartDate,
        contractEndDate: fresh.contractEndDate,
        contractAmount: fresh.contractAmount,
        contractPeriod: fresh.contractPeriod,
        contractHistory: fresh.contractHistory,
      }, null, 2));
    }
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});