// migrate-applicant-records.js
// Run once from your backend root:  node migrate-applicant-records.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const mongoose         = require('mongoose');
const CandidateApplication = require('./models/Candidateapplication');
const ApplicantRecord      = require('./models/ApplicantRecord');

const FIELDS_TO_COPY = [
  'full_name', 'email', 'phone', 'whatsapp_same', 'dob',
  'country', 'state', 'city', 'pin_code', 'relocation',
  'designation', 'designation_id', 'highest_qualification',
  'experience', 'total_experience', 'current_ctc', 'notice_period',
  'expected_monthly_ctc',
  'hindi_read', 'hindi_write', 'hindi_speak',
  'english_read', 'english_write', 'english_speak',
  'facebookLink', 'linkedin', 'short_video_url',
];

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const applications = await CandidateApplication.find({}).lean();
  console.log(`Found ${applications.length} applications`);

  let created = 0;
  let skipped = 0;

  for (const app of applications) {
    // Skip if a record already exists for this application
    const exists = await ApplicantRecord.findOne({ applicationRef: app._id });
    if (exists) { skipped++; continue; }

    const payload = { applicationRef: app._id };
    for (const field of FIELDS_TO_COPY) {
      payload[field] = app[field] ?? '';
    }

    await ApplicantRecord.create(payload);
    created++;
    console.log(`  ✓ ${app.full_name || app.email}`);
  }

  console.log(`\nDone. Created: ${created}  Skipped (already existed): ${skipped}`);
  await mongoose.disconnect();
}

migrate().catch((e) => { console.error(e); process.exit(1); });