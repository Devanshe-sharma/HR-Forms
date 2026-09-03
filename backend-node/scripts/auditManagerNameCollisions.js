// One-off audit — checks every currently-open SalaryRevision's resolved
// manager NAME against Onboarding for name collisions (multiple people
// sharing that name), which resolveManagerContact.js now defends against
// but is worth surfacing explicitly after a real mis-send caused by
// exactly this (two "Tanisha Sharma"s, one departed).
require('dotenv').config();

const mongoose = require('mongoose');
const SalaryRevision = require('../models/SalaryRevision');
const Onboarding = require('../models/onboardingModel');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const revs = await SalaryRevision.find({ stage: { $in: ['pending_manager', 'pending_management', 'pending_hr', 'on_hold'] } })
    .select('employeeName department previousReportingHead newReportingHead onboardingId').lean();

  for (const r of revs) {
    let name = r.previousReportingHead || r.newReportingHead;
    if (r.onboardingId) {
      const emp = await Onboarding.findById(r.onboardingId).select('reviewerName reportingHead').lean();
      name = (emp && (emp.reviewerName || emp.reportingHead)) || name;
    }
    if (!name) {
      console.log(r.employeeName, '-> NO MANAGER NAME ON FILE');
      continue;
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = await Onboarding.find({ name: new RegExp('^' + escaped + '$', 'i') })
      .select('name dept exitStatus officialEmail').lean();
    const flag = matches.length > 1 ? '  <-- AMBIGUOUS' : '';
    console.log(r.employeeName.padEnd(25), '| Manager:', name.padEnd(22), '| matches:', matches.length, flag);
    if (matches.length > 1) {
      matches.forEach((m) => console.log('    -', m.dept, '|', m.exitStatus || '(active)', '|', m.officialEmail));
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Script failed:', err.message);
  process.exitCode = 1;
});
