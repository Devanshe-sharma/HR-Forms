require('dotenv').config();

const mongoose = require('mongoose');
const Project = require('../models/Project');

// Placeholder data — replace/extend with real project services & names.
const PLACEHOLDER_PROJECTS = [
  { service: 'IT Services', name: 'Project Alpha' },
  { service: 'IT Services', name: 'Project Beta' },
  { service: 'Delivery Services', name: 'Project Gamma' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const project of PLACEHOLDER_PROJECTS) {
    await Project.updateOne(
      { service: project.service, name: project.name },
      { $setOnInsert: project },
      { upsert: true }
    );
  }

  console.log(`Seeded ${PLACEHOLDER_PROJECTS.length} placeholder projects.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
