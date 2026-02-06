require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

console.log(
  "ENV LOADED:",
  !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON
);

// ─── ROUTES ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('Backend server is alive!');
});

app.use('/api/employees', require('./routes/employees'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/designations', require('./routes/designations'));
app.use('/api/hiringrequisitions', require('./routes/hiringRequisitions'));
app.use('/api/ctc-components', require('./routes/ctcComponents'));
app.use('/api/training', require('./routes/training'));
app.use('/api/requisition', require('./routes/requisition'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/exit', require('./routes/exit'));
app.use('/api/outing', require('./routes/outing'));

// ─── DATABASE CONNECTION ──────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// ─── EMAIL & AUTO-ARCHIVE SCHEDULER ───────────────────────
const { startEmailScheduler } = require('./emails/scheduler');
startEmailScheduler();

// ─── DAILY OUTING COMPLETION & ARCHIVE JOB ────────────────
cron.schedule('30 0 * * *', async () => {
  console.log('Running daily outing completion & archive job...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const Outing = require('./models/Outing');

  // 1. Mark Scheduled → Completed if date is today or earlier
  const toComplete = await Outing.find({
    status: 'Scheduled',
    tentativeDate: { $lte: today }
  });

  for (const o of toComplete) {
    o.status = 'Completed';
    await o.save();
    console.log(`Auto-completed: ${o.topic}`);
  }

  // 2. Archive Completed ones after 3 days
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const toArchive = await Outing.find({
    status: 'Completed',
    tentativeDate: { $lte: threeDaysAgo }
  });

  for (const o of toArchive) {
    o.status = 'Archived';
    o.archivedAt = new Date();
    await o.save();
    console.log(`Auto-archived: ${o.topic}`);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// ─── GOOGLE SHEET SYNC ENDPOINT (optional) ────────────────
app.post('/sync-sheet', async (req, res) => {
  try {
    const data = req.body;
    const Employee = require('./models/Employee');
    await Employee.updateOne(
      { sheetRowId: data.sheetRowId },
      { $set: data },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log('=== FORCING 2-WEEK OUTING REMINDER TEST ===');
(async () => {
  try {
    const result = await require('./emails/emailUpcomingOutingReminder').sendUpcomingOutingReminder();
    console.log('Test result:', result);
  } catch (err) {
    console.error('Test failed:', err);
  }
})();