require('dotenv').config();
const mongoose = require('mongoose');
const Exit = require('./models/exitModel');

// One-time backfill: every EXISTING Exit record with exitStatus
// "Already Left" that isn't already fmsStatus "Closed" gets closed now,
// to match the updated deriveFmsStatus rule in routes/exit.js (Already
// Left now closes immediately, same as Left/Not Exiting/Exit Cancelled,
// regardless of checklist completion). Only touches fmsStatus — doesn't
// re-score, re-approve, or touch checklist/plan dates. No emails sent.

async function backfillCloseAlreadyLeftExits() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  const docs = await Exit.find({
    exitStatus: 'Already Left',
    fmsStatus: { $ne: 'Closed' },
  }).select('name fmsStatus');

  console.log(`Found ${docs.length} "Already Left" exit(s) not yet Closed.\n`);

  for (const doc of docs) {
    console.log(`✅ "${doc.name}" — fmsStatus ${doc.fmsStatus || '(none)'} -> Closed`);
  }

  if (docs.length > 0) {
    const result = await Exit.updateMany(
      { exitStatus: 'Already Left', fmsStatus: { $ne: 'Closed' } },
      { $set: { fmsStatus: 'Closed' } }
    );
    console.log(`\nDone. Closed: ${result.modifiedCount}. No emails were sent.`);
  } else {
    console.log('\nNothing to do.');
  }

  await mongoose.disconnect();
}

backfillCloseAlreadyLeftExits().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
