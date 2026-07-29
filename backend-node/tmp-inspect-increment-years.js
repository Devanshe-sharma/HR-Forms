require('dotenv').config();
const mongoose = require('mongoose');
const SalaryRevision = require('./models/SalaryRevision');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const recs = await SalaryRevision.find({ stage: 'completed' }).lean();
  const years = {};
  for (const r of recs) {
    const date = new Date(r.applicableDate || r.createdAt);
    const y = date.getFullYear();
    if (!years[y]) years[y] = [];
    years[y].push({
      _id: r._id,
      employeeName: r.employeeName,
      applicableDate: r.applicableDate,
      createdAt: r.createdAt,
      finalIncrementPct: r.finalIncrementPct,
      previousCtc: r.previousCtc,
      newCtc: r.newCtc,
      categoryChanged: r.categoryChanged,
      previousCategory: r.previousCategory,
      newCategory: r.newCategory,
    });
  }
  const sortedYears = Object.keys(years).map(Number).sort((a,b)=>b-a);
  console.log('years:', sortedYears.join(', '));
  for (const y of sortedYears) {
    console.log('year', y, 'count', years[y].length);
    years[y].slice(0, 5).forEach(r => console.log(JSON.stringify(r, null, 2)));
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});