require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');
const SalaryRevision = require('./models/SalaryRevision');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const onboardingId = '6a41e8e005a36d95f3b01496'; // Ritika Srivastava

  // Desired history entries
  const history = [
    { startDate: new Date('2023-08-24T00:00:00.000Z'), endDate: new Date('2024-08-23T23:59:59.999Z') },
    { startDate: new Date('2024-08-24T00:00:00.000Z'), endDate: new Date('2025-08-23T23:59:59.999Z') },
    { startDate: new Date('2025-08-24T00:00:00.000Z'), endDate: null },
  ];

  // Update onboarding
  const obUpdate = {
    contractHistory: history,
    contractStartDate: history[2].startDate,
    contractEndDate: null,
    contractAmount: 1409764,
    contractPeriod: 12,
  };
  const obRes = await Onboarding.findByIdAndUpdate(onboardingId, { $set: obUpdate }, { new: true }).lean();
  console.log('Onboarding updated:', obRes?._id);

  // Fetch salary revisions for this employeeCode
  const revisions = await SalaryRevision.find({ employeeCode: onboardingId }).sort({ createdAt: 1 }).exec();
  console.log('Found revisions:', revisions.map(r=>({ _id: r._id.toString(), createdAt: r.createdAt, previousCtc: r.previousCtc, newCtc: r.newCtc })));

  // Map oldest -> 2023, middle -> 2024, newest -> 2025
  const mapping = [
    { start: history[0].startDate, end: history[0].endDate, prev: null, newCtc: 1021610, applicableDate: history[0].startDate },
    { start: history[1].startDate, end: history[1].endDate, prev: 1021610, newCtc: 1174801, applicableDate: history[1].startDate },
    { start: history[2].startDate, end: null, prev: 1174801, newCtc: 1409764, applicableDate: history[2].startDate },
  ];

  for (let i = 0; i < revisions.length && i < mapping.length; i++) {
    const rev = revisions[i];
    const m = mapping[i];
    rev.contractStartDate = m.start;
    rev.contractEndDate = m.end;
    rev.newContractStartDate = m.start;
    rev.newContractEndDate = m.end;
    rev.applicableDate = m.applicableDate;
    if (m.prev !== null) rev.previousCtc = m.prev;
    rev.newCtc = m.newCtc;
    rev.hrDecision = rev.hrDecision || {};
    rev.hrDecision.newCtc = m.newCtc;
    rev.hrDecision.applicableDate = m.applicableDate;
    rev.hrDecision.newContractStartDate = m.start;
    rev.hrDecision.newContractEndDate = m.end;
    rev.stage = 'completed';
    await rev.save();
    console.log('Updated revision:', rev._id.toString());
  }

  // If there are more revisions than mapping entries, clear their contract dates
  for (let j = mapping.length; j < revisions.length; j++) {
    const r = revisions[j];
    r.contractStartDate = null;
    r.contractEndDate = null;
    r.newContractStartDate = null;
    r.newContractEndDate = null;
    await r.save();
    console.log('Cleared extra revision dates:', r._id.toString());
  }

  // Print final state
  const finalOnb = await Onboarding.findById(onboardingId).lean();
  const finalRevs = await SalaryRevision.find({ employeeCode: onboardingId }).sort({ createdAt: -1 }).lean();
  console.log('Final onboarding contractHistory:', finalOnb.contractHistory);
  console.log('Final revisions (newest first):');
  finalRevs.forEach(r => console.log(JSON.stringify({ _id: r._id, previousCtc: r.previousCtc, newCtc: r.newCtc, contractStartDate: r.contractStartDate, contractEndDate: r.contractEndDate, newContractStartDate: r.newContractStartDate, newContractEndDate: r.newContractEndDate, applicableDate: r.applicableDate }, null, 2)));

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });