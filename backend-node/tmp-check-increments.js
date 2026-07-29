require('dotenv').config();
const mongoose = require('mongoose');
const SalaryRevision = require('./models/SalaryRevision');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const recs = await SalaryRevision.find({ stage: 'completed' }).lean();
  const yearOf = (r) => new Date(r.applicableDate || r.createdAt).getFullYear();
  const years = {};
  for (const r of recs) {
    const y = yearOf(r);
    if (!years[y]) years[y] = [];
    years[y].push(r);
  }
  const sorted = Object.keys(years).map(Number).sort((a,b)=>b-a);
  console.log('all years:', sorted.join(', '));
  for (const y of sorted) {
    const all = years[y];
    const usable = all.filter(r => r.finalIncrementPct != null);
    const nonConversion = usable.filter(r => !(r.categoryChanged && ['Intern','Contract Based'].includes(r.previousCategory) && r.newCategory === 'Employee'));
    console.log('year', y, 'all', all.length, 'usable', usable.length, 'nonConversion', nonConversion.length);
    if (y===2025 || y===2024 || y===2023) {
      console.log('  sample', nonConversion.slice(0,5).map(r=>({ _id:r._id, employeeName:r.employeeName, applicableDate:r.applicableDate, createdAt:r.createdAt, finalIncrementPct:r.finalIncrementPct, previousCategory:r.previousCategory, newCategory:r.newCategory })));
    }
  }
  await mongoose.disconnect();
}
run().catch(err => { console.error(err); process.exit(1); });