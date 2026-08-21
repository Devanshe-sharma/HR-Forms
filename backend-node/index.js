require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const trainingRoutes = require('./routes/trainingTopic');
const hiringFormRoutes = require('./routes/hiringFormData');
const app = express();
const geoRoutes = require('./routes/geo');
const { attachUser } = require('./middleware/authenticate');



const PRODUCTION_ORIGINS = [
  'http://3.110.162.1:3000',
  'http://hr.briskolive.com',
  'https://hr.briskolive.com',
]
/* ─────────────────── MIDDLEWARE ─────────────────── */
app.use(cors({
  origin: (origin, callback) => {
    // No Origin header at all — same-origin requests, curl, server-to-
    // server calls, etc. Always allow.
    if (!origin) return callback(null, true);
 
    if (PRODUCTION_ORIGINS.includes(origin)) return callback(null, true);
 
    // Any localhost port, any protocol (http covers the normal dev
    // server case).
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
 
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-api-key'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));


app.use(express.json({ limit: "10mb" }));
// Needed so the plain HTML <form> on the interview "Can't attend" reason
// page (submitted straight from the candidate's browser, not fetch/JSON)
// parses into req.body.
app.use(express.urlencoded({ extended: true }));

// Auth: verify a Bearer JWT if present and attach req.user (never blocks —
// routes that require login use the `authenticate` middleware directly).
app.use('/api', attachUser);

// RBAC: role comes from a verified JWT (req.user) when present, since that
// can't be spoofed by the client. Falls back to the legacy x-user-role
// header only when no one is logged in, so existing behavior is unchanged
// until a route starts requiring authentication.
app.use('/api', (req, res, next) => {
  req.role = req.user?.role || req.headers['x-user-role'] || '';
  next();
});

/* ─────────────────── ENV CHECK ─────────────────── */
console.log("ENV CHECK:", {
  mongo:             !!process.env.MONGO_URI,
  googleClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey:  !!process.env.GOOGLE_PRIVATE_KEY,
});

/* ─────────────────── ROUTES ─────────────────── */
app.get('/health', (req, res) => res.send('Backend server is alive!'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/users',              require('./routes/users'));
app.use('/api/external',           require('./routes/externalApi'));
app.use('/api/employees',          require('./routes/employees'));
app.use('/api/confirmations',      require('./routes/confirmations'));
app.use('/api/roles',              require('./routes/roles'));
app.use('/api/hiringrequisitions', require('./routes/hiringRequisitions'));
app.use('/api/ctc-components',     require('./routes/ctcComponents'));
// app.use('/api/trainings',          require('./routes/training'));
app.use("/api/rolemaster", require("./routes/roles"));
app.use('/api/hiring-form',        require('./routes/hiringFormData'));
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

app.use('/api/onboarding',         require('./routes/onboardingroutes'));
app.use('/api/exit',               require('./routes/exit'));
app.use('/api/outing',             require('./routes/outing'));
app.use('/api/projects',           require('./routes/projects'));
app.use('/api/dept-kpi',           require('./routes/dept-kpi'));
app.use('/api/role-kpi',           require('./routes/role-kpi'));
app.use('/api/dept-targets',       require('./routes/dept-targets'));
app.use('/api/role-targets',       require('./routes/role-targets'));
app.use('/api/hygiene',            require('./routes/hygiene'));
app.use('/api/growth',             require('./routes/growth'));
app.use('/api',                    require('./routes/sheetWebhook'));
app.use('/api/sync',               require('./routes/syncFms'));
app.use('/api/candidate-applications', require('./routes/candidateApplications'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/rbac', require('./routes/rbac'));
app.use('/api/geo', geoRoutes);
app.use("/api/kpi", require("./routes/kpiRoutes"));

app.use('/api/applicant-records', require('./routes/applicantRecords'));
app.use('/api/dept-orientation',   require('./routes/deptOrientationRoutes'));
app.use('/api/orientation',        require('./routes/orientationRoutes'));
app.use('/api/salary-revisions',   require('./routes/salaryRevisions'));
app.use('/api/escalations',        require('./routes/escalations'));
app.use('/api/out-of-office',      require('./routes/outOfOffice'));

/* ─────────────────── FRONTEND STATIC FILES ─────────────────────
   Serves the built React/Vue/etc app from frontend/dist.
   Must come AFTER all /api routes above, so API calls are never
   swallowed by the catch-all below.
   Adjust the path if your folder layout differs. ───────────────── */
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist');
app.use(express.static(FRONTEND_DIST));

app.use((req, res) => {
  // Static assets (bundle.<hash>.js, .css, .map, images, ...) that don't
  // exist on disk must 404, not fall back to index.html. Otherwise a
  // stale tab/cache referencing a bundle filename deleted by the last
  // deploy gets back HTML for a script request, which the browser then
  // fails to parse as JS ("Unexpected token '<'").
  if (path.extname(req.path)) {
    return res.status(404).end();
  }
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

/* ─────────────────── DATABASE ─────────────────── */

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // ✅ safe: DB is ready
    console.log('🧪 Testing upcoming outing reminder...');
    const result = await require('./emails/emailUpcomingOutingReminder')
      .sendUpcomingOutingReminder();
    console.log('Test result:', result);

  })
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
