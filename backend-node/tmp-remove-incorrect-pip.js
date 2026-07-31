require('dotenv').config();
const mongoose = require('mongoose');
const SalaryRevision = require('./models/SalaryRevision');

// Shivharsh Dubey and Siddharth Kumar were never actually on PIP — their
// on_hold records were a data-entry mistake. Reverting to an undecided
// pending_manager state (rather than deleting) keeps the record
// reversible/auditable instead of erasing history.

const IDS = [
  "69e5fea68fc12019b0181307", // Shivharsh Dubey
  "6a44f59668c8bfe7635eb1ad", // Siddharth Kumar
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const id of IDS) {
    const doc = await SalaryRevision.findByIdAndUpdate(
      id,
      {
        stage: "pending_manager",
        reviewDate: null,
        managerDecision: {
          decision: null,
          recommendedPct: null,
          pipDurationMonths: null,
          pipNewDueDate: null,
          reason: "",
          submittedAt: null,
        },
        managementDecision: {
          finalPct: null,
          pipApproved: null,
          reason: "",
          submittedAt: null,
        },
      },
      { new: true }
    );
    console.log(doc ? `Reverted ${doc.employeeName} (${id}) to pending_manager` : `NOT FOUND: ${id}`);
  }

  await mongoose.disconnect();
}
run().catch((err) => { console.error(err); process.exit(1); });
