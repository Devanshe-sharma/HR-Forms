require('dotenv').config();
const mongoose = require('mongoose');
const SalaryRevision = require('./models/SalaryRevision');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const employeeCode = '6a41e8e005a36d95f3b01496';
  const revisions = await SalaryRevision.find({ employeeCode }).sort({ createdAt: 1 }).exec();
  console.log('Found', revisions.length, 'revisions');
  const periods = [
    { start: new Date('2023-08-24T00:00:00.000Z'), end: new Date('2024-08-23T23:59:59.999Z'), previousCtc: 1021610, newCtc: null, applicableDate: new Date('2023-08-24T00:00:00.000Z') },
    { start: new Date('2024-08-24T00:00:00.000Z'), end: new Date('2025-08-23T23:59:59.999Z'), previousCtc: 1021610, newCtc: 1174801, applicableDate: new Date('2024-08-24T00:00:00.000Z') },
    { start: new Date('2025-08-24T00:00:00.000Z'), end: null, previousCtc: 1174801, newCtc: 1409764, applicableDate: new Date('2025-08-24T00:00:00.000Z') },
  ];

  for (let i = 0; i < revisions.length && i < periods.length; i++) {
    const rev = revisions[i];
    const p = periods[i];
    rev.contractStartDate = p.start;
    rev.contractEndDate = p.end;
    rev.newContractStartDate = p.start;
    rev.newContractEndDate = p.end;
    rev.applicableDate = p.applicableDate;
    rev.previousCtc = p.previousCtc;
    rev.newCtc = p.newCtc;
    rev.hrDecision = rev.hrDecision || {};
    rev.hrDecision.newCtc = p.newCtc;
    rev.hrDecision.applicableDate = p.applicableDate;
    rev.hrDecision.newContractStartDate = p.start;
    rev.hrDecision.newContractEndDate = p.end;
    rev.stage = 'completed';
    await rev.save();
    console.log('Patched revision', rev._id.toString());
  }

  await mongoose.disconnect();
}
run().catch(err => { console.error(err); process.exit(1); });