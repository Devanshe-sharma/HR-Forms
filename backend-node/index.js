require('dotenv').config();

const express = require('express');

const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const trainingRoutes = require('./routes/training');

const app = express();

/* ─────────────────── MIDDLEWARE ─────────────────── */
app.use(cors());
app.use(express.json());

// RBAC: set role from header for API routes (frontend sends x-user-role)
app.use('/api', (req, res, next) => {
  req.role = req.headers['x-user-role'] || req.user?.role || '';
  next();
});

/* ─────────────────── ENV CHECK ─────────────────── */
console.log("ENV CHECK:", {
  mongo:             !!process.env.MONGO_URI,
  googleClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey:  !!process.env.GOOGLE_PRIVATE_KEY,
});

/* ─────────────────── ROUTES ─────────────────── */
app.get('/', (req, res) => res.send('Backend server is alive!'));

app.use('/api/employees',          require('./routes/employees'));
app.use('/api/departments',        require('./routes/departments'));
app.use('/api/designations',       require('./routes/designations'));
app.use('/api/hiringrequisitions', require('./routes/hiringRequisitions'));
app.use('/api/ctc-components',     require('./routes/ctcComponents'));
app.use('/api/trainings',          require('./routes/training'));
app.use('/api/required-score-by-level', require('./routes/requiredScoreByLevel'));
app.use('/api/capabilities',       require('./routes/capabilities'));
app.use('/api/capability-assessment', require('./routes/capabilityAssessment'));
app.use('/api/capability-role-map', require('./routes/capabilityRoleMap'));
app.use('/api/training-suggestions', require('./routes/trainingSuggestions'));
app.use('/api/training-schedule',  require('./routes/trainingSchedule'));
app.use('/api/training-materials', require('./routes/trainingMaterials'));
app.use('/api/training-feedback',  require('./routes/trainingFeedback'));
app.use('/api/employee-scores',    require('./routes/employeeScores'));
app.use('/api/requisition',        require('./routes/requisition'));
app.use('/api/onboarding',         require('./routes/onboarding'));
app.use('/api/exit',               require('./routes/exit'));
app.use('/api/outing',             require('./routes/outing'));
app.use('/api',                    require('./routes/sheetWebhook'));
app.use('/api/sync',               require('./routes/syncFms'));

/* ─────────────────── DATABASE ─────────────────── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

/* ─────────────────── EMAIL SCHEDULER ─────────────────── */
const { startEmailScheduler } = require('./emails/scheduler');
startEmailScheduler();

/* ─────────────────── DAILY CRON JOB ─────────────────── */
cron.schedule(
  '30 0 * * *',
  async () => {
    console.log('🕒 Running daily outing completion & archive job...');

    const Outing = require('./models/Outing');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1️⃣ Scheduled → Completed
    const toComplete = await Outing.find({
      status: 'Scheduled',
      tentativeDate: { $lte: today },
    });

    for (const o of toComplete) {
      o.status = 'Completed';
      await o.save();
      console.log(`✔ Completed: ${o.topic}`);
    }

    // 2️⃣ Completed → Archived (after 3 days)
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const toArchive = await Outing.find({
      status: 'Completed',
      tentativeDate: { $lte: threeDaysAgo },
    });

    for (const o of toArchive) {
      o.status = 'Archived';
      o.archivedAt = new Date();
      await o.save();
      console.log(`📦 Archived: ${o.topic}`);
    }
  },
  { timezone: 'Asia/Kolkata' }
);

/* ─────────────────── SERVER START ─────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

/* ─────────────────── DEV TEST (Optional) ─────────────────── */
// Comment this out in production
(async () => {
  try {
    console.log('🧪 Testing upcoming outing reminder...');
    const result = await require('./emails/emailUpcomingOutingReminder')
      .sendUpcomingOutingReminder();
    console.log('Test result:', result);
  } catch (err) {
    console.error('Reminder test failed:', err.message);
  }
})();