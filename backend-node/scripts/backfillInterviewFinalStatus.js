// One-off backfill — before this fix, interviewFinalStatus defaulted to
// 'In Progress' for every candidate the moment their ApplicantRecord was
// created, regardless of whether any interview round had actually happened.
// This corrects existing records: anyone still sitting at 'In Progress'
// with no interview round marked Done is reset to the new 'New' default.
// Records already Shortlisted/Rejected (a real HR decision) are untouched.
require('dotenv').config();

const mongoose = require('mongoose');
const ApplicantRecord = require('../models/ApplicantRecord');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const candidates = await ApplicantRecord.find({ interviewFinalStatus: 'In Progress' });

  let resetCount = 0;
  for (const record of candidates) {
    const hasDoneRound = (record.interviewRounds || []).some((r) => r.schedulingStatus === 'Done');
    if (!hasDoneRound) {
      record.interviewFinalStatus = 'New';
      await record.save();
      resetCount++;
    }
  }

  console.log(`Checked ${candidates.length} record(s) at 'In Progress'.`);
  console.log(`Reset ${resetCount} record(s) to 'New' (no Done round on file).`);
  console.log(`Left ${candidates.length - resetCount} record(s) at 'In Progress' (have a Done round).`);
}

main()
  .catch((err) => {
    console.error('Script failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
