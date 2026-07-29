require('dotenv').config();
const mongoose = require('mongoose');
const SalaryRevision = require('./models/SalaryRevision');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const employeeCode = '6a41e8e005a36d95f3b01496';
  const docs = await SalaryRevision.find({ employeeCode }).sort({ createdAt: -1 }).lean();
  console.log('count', docs.length);
  docs.forEach(doc => {
    console.log(JSON.stringify({
      _id: doc._id,
      employeeName: doc.employeeName,
      stage: doc.stage,
      contractStartDate: doc.contractStartDate,
      contractEndDate: doc.contractEndDate,
      newContractStartDate: doc.newContractStartDate,
      newContractEndDate: doc.newContractEndDate,
      applicableDate: doc.applicableDate,
      previousCtc: doc.previousCtc,
      newCtc: doc.newCtc,
      createdAt: doc.createdAt,
      hrDecision: doc.hrDecision,
      managerDecision: doc.managerDecision,
      managementDecision: doc.managementDecision,
    }, null, 2));
  });
  await mongoose.disconnect();
}
run().catch(err => { console.error(err); process.exit(1); });