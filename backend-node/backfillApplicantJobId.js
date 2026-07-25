require('dotenv').config();
const mongoose = require('mongoose');
const ApplicantRecord = require('./models/ApplicantRecord');
const HiringRequisition = require('./models/HiringRequisition');

// One-time backfill: ApplicantRecords created before the job_id fix have
// no job_id at all, so the AI analysis endpoint can't look up their
// matching requisition. Since these old records don't have job_id to
// begin with, this matches by designation instead — finding whichever
// HiringRequisition has the same designation and was closest in time to
// when the candidate actually applied (their record's own createdAt).
//
// Multiple requisitions can share the same designation across different
// hiring cycles, so a plain designation match alone would be ambiguous.
// The closest-date tiebreaker is a reasonable guess (a candidate was
// most likely applying to whichever requisition was open around when
// they applied), but it's still a guess — anything genuinely ambiguous
// or with zero matches is logged and skipped rather than guessed at
// silently, so these can be reviewed and fixed manually if needed.
//
// Does NOT touch anything else on the record — only sets job_id.

async function backfillJobId() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const records = await ApplicantRecord.find({
    job_id: null,
    designation: { $ne: '' },
  });
  console.log(`Found ${records.length} record(s) missing job_id.\n`);

  let matched = 0, ambiguousResolved = 0, noMatch = 0, noDesignation = 0;

  for (const record of records) {
    if (!record.designation) {
      console.log(`⚠️  "${record.full_name}" has no designation at all — skipped.`);
      noDesignation++;
      continue;
    }

    const candidates = await HiringRequisition.find({
      designation: { $regex: `^${record.designation.trim()}$`, $options: 'i' },
    }).lean();

    if (candidates.length === 0) {
      console.log(`❌ "${record.full_name}" (${record.designation}) — no matching requisition found.`);
      noMatch++;
      continue;
    }

    if (candidates.length === 1) {
      record.job_id = candidates[0].serial_no;
      await record.save();
      console.log(`✅ "${record.full_name}" (${record.designation}) — matched requisition #${candidates[0].serial_no}.`);
      matched++;
      continue;
    }

    // Multiple requisitions share this designation — pick whichever's
    // request_date is closest to when this candidate actually applied.
    const appliedAt = new Date(record.createdAt).getTime();
    let closest = candidates[0];
    let closestDiff = Infinity;

    for (const c of candidates) {
      if (!c.request_date) continue;
      const diff = Math.abs(new Date(c.request_date).getTime() - appliedAt);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = c;
      }
    }

    record.job_id = closest.serial_no;
    await record.save();
    console.log(`🔶 "${record.full_name}" (${record.designation}) — ${candidates.length} requisitions shared this designation; picked #${closest.serial_no} as closest by date. Worth double-checking this one.`);
    ambiguousResolved++;
  }

  console.log(`\nDone. Cleanly matched: ${matched}, resolved via date tiebreaker (review these): ${ambiguousResolved}, no match found: ${noMatch}, no designation at all: ${noDesignation}.`);
  await mongoose.disconnect();
}

backfillJobId().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});