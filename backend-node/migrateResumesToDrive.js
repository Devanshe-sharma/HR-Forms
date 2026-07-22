require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const CandidateApplication = require('./models/Candidateapplication');
const ApplicantRecord = require('./models/ApplicantRecord');
const { uploadResumeToDrive } = require('./utils/googleDrive');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One-time migration: every CandidateApplication whose resume is still a
// local disk path (from before the Drive upload fix) gets its actual
// file read from disk, re-uploaded to the same Shared Drive folder new
// submissions now use, and both CandidateApplication and its matching
// ApplicantRecord get updated with the resulting Drive link. Anything
// already migrated (a real Drive link) or genuinely blank is left alone
// — safe to re-run, since the query only ever matches local-path values.
async function migrateResumesToDrive() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const candidates = await CandidateApplication.find({
    resume: { $regex: '^/uploads/resumes/' },
  });

  console.log(`Found ${candidates.length} application(s) with a local resume path to migrate.\n`);

  let migrated = 0;
  let skippedMissingFile = 0;
  let failed = 0;

  for (const doc of candidates) {
    const localPath = path.join(__dirname, doc.resume);

    if (!fs.existsSync(localPath)) {
      console.error(`❌ File missing on disk for ${doc.full_name} (${doc._id}): ${localPath}`);
      skippedMissingFile++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const originalName = `${(doc.full_name || 'resume').replace(/[^\w\s-]/g, '')}.pdf`;

      const driveLink = await uploadResumeToDrive(buffer, originalName, 'application/pdf');

      await CandidateApplication.findByIdAndUpdate(doc._id, { resume: driveLink });
      await ApplicantRecord.updateMany({ applicationRef: doc._id }, { resume: driveLink });

      console.log(`✅ Migrated ${doc.full_name} (${doc._id}) -> ${driveLink}`);
      migrated++;

      // Small pacing delay — 189 sequential uploads with zero delay risks
      // tripping Google's per-second rate limit partway through.
      await sleep(300);
    } catch (err) {
      console.error(`❌ Failed to migrate ${doc.full_name} (${doc._id}):`, err.message);
      failed++;
    }
  }

  console.log('\n--- Migration complete ---');
  console.log(`Migrated:            ${migrated}`);
  console.log(`Skipped (no file):   ${skippedMissingFile}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Total processed:     ${candidates.length}`);

  await mongoose.disconnect();
}

migrateResumesToDrive().catch((err) => {
  console.error('Migration script crashed:', err);
  process.exit(1);
});