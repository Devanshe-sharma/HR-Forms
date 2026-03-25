require('dotenv').config();

const express = require('express');

const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const trainingRoutes = require('./routes/trainingTopic');

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
app.use('/api/confirmations',      require('./routes/confirmations'));
app.use('/api/departments',        require('./routes/departments'));
app.use('/api/designations',       require('./routes/designations'));
app.use('/api/hiringrequisitions', require('./routes/hiringRequisitions'));
app.use('/api/ctc-components',     require('./routes/ctcComponents'));
// app.use('/api/trainings',          require('./routes/training'));
app.use('/api/required-score-by-level', require('./routes/requiredScoreByLevel'));
app.use('/api/capability-areas',    require('./routes/capabilityAreas'));
app.use('/api/capability-skills',   require('./routes/capabilitySkills'));
app.use('/api/capability-evaluations', require('./routes/capabilityEvaluations'));
app.use('/api/training-topics',    require('./routes/trainingTopic'));
app.use('/api/training-schedules',  require('./routes/trainingSchedules'));
// app.use('/api/training-materials', require('./routes/trainingMaterials'));
app.use('/api/training-feedback',  require('./routes/trainingFeedback'));
app.use('/api/training-assessments', require('./routes/trainingAssessments'));
app.use('/api/employee-scores',    require('./routes/employeeScores'));
app.use('/api/requisition',        require('./routes/requisition'));
app.use('/api/onboarding',         require('./routes/onboarding'));
app.use('/api/exit',               require('./routes/exit'));
app.use('/api/outing',             require('./routes/outing'));
app.use('/api/dept-kpi',           require('./routes/dept-kpi'));
app.use('/api/role-kpi',           require('./routes/role-kpi'));
app.use('/api/dept-targets',       require('./routes/dept-targets'));
app.use('/api/role-targets',       require('./routes/role-targets'));
app.use('/api/hygiene',            require('./routes/hygiene'));
app.use('/api/growth',             require('./routes/growth'));
app.use('/api',                    require('./routes/sheetWebhook'));
app.use('/api/sync',               require('./routes/syncFms'));


app.use('/api/dept-orientation',   require('./routes/deptOrientationRoutes'));
app.use('/api/orientation',        require('./routes/orientationRoutes'));
app.use('/api/salary-revisions',   require('./routes/salaryRevisions')); 

/* ─────────────────── DATABASE ─────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });

/* ─────────────────── EMAIL SCHEDULER ─────────────────── */
const { startEmailScheduler } = require('./emails/scheduler');
startEmailScheduler();

/* ─────────────────── EXTENSION SCHEDULER ─────────────────── */
const { startExtensionScheduler } = require('./scheduler/extensionScheduler');
startExtensionScheduler();

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