// One-off migration: encrypt existing plaintext bank details and
// PAN/Aadhaar/UAN values in the Employee and Onboarding collections, now
// that both schemas encrypt these fields going forward (see
// utils/piiEncryption.js and the applyPIIEncryption() hooks added to both
// models). Idempotent and safe to re-run — encryptPII() is a no-op on a
// value that's already encrypted, so already-migrated records are skipped.
//
// Writes via the raw MongoDB driver (collection.updateOne), not
// Model.save(), so this never triggers schema validation on old/partial
// records and can't accidentally touch any field outside PII_FIELDS.
//
// Usage:
//   node scripts/encryptExistingPII.js --dry-run   (prints what would change)
//   node scripts/encryptExistingPII.js --apply     (writes changes)
require('dotenv').config();

const mongoose = require('mongoose');
const { encryptPII, isEncrypted, PII_FIELDS } = require('../utils/piiEncryption');

async function migrateCollection(collectionName, apply) {
  const coll = mongoose.connection.db.collection(collectionName);
  const cursor = coll.find({}, { projection: Object.fromEntries(PII_FIELDS.map((f) => [f, 1])) });

  let scanned = 0, updated = 0, alreadyEncrypted = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned++;

    const set = {};
    for (const field of PII_FIELDS) {
      const value = doc[field];
      if (typeof value === 'string' && value) {
        if (isEncrypted(value)) continue;
        set[field] = encryptPII(value);
      }
    }

    if (Object.keys(set).length === 0) {
      alreadyEncrypted++;
      continue;
    }

    if (apply) await coll.updateOne({ _id: doc._id }, { $set: set });
    updated++;
  }

  console.log(`\n${collectionName}:`);
  console.log(`  Scanned:               ${scanned}`);
  console.log(`  ${apply ? 'Encrypted' : 'Would encrypt'}:            ${updated}`);
  console.log(`  Already clean/empty:   ${alreadyEncrypted}`);
}

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY) {
    throw new Error(
      'PII_ENCRYPTION_KEY is not set. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      'and add it to backend-node/.env before running this migration.'
    );
  }

  const apply = process.argv.includes('--apply');

  await mongoose.connect(process.env.MONGO_URI);

  await migrateCollection('employees', apply);
  await migrateCollection('onboardings', apply);

  if (!apply) {
    console.log('\nThis was a dry run — no changes were written. Re-run with --apply to commit.');
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
