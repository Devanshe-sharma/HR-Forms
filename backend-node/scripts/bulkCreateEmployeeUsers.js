// One-off script: create a User login account for every current employee
// (Onboarding record with joiningStatus 'Joined' and not exited) who
// doesn't already have one. New accounts get a shared temporary password
// and mustChangePassword:true, forcing a real password on first login —
// see routes/auth.js's /change-password and the frontend's ProtectedRoute
// gate. Existing accounts (matched by email) are never touched.
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Onboarding = require('../models/onboardingModel');

const TEMP_PASSWORD = 'test@1234';
const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const employees = await Onboarding.find({ joiningStatus: 'Joined' }).lean();
  const current = employees.filter((e) => !EXITED_STATUS_VALUES.has(e.exitStatus || ''));

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  let created = 0, skippedExisting = 0, skippedNoEmail = 0;
  const errors = [];

  for (const emp of current) {
    const email = (emp.officialEmail || '').trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      console.log(`[skip: no email] ${emp.name || emp.empId || emp._id}`);
      continue;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      skippedExisting++;
      continue;
    }

    try {
      await User.create({
        name: (emp.name || email).trim(),
        email,
        passwordHash,
        role: 'Employee',
        employeeId: emp.empId || null,
        mustChangePassword: true,
      });
      created++;
      console.log(`[created] ${email} (${emp.name || 'no name'})`);
    } catch (e) {
      errors.push({ email, message: e.message });
      console.error(`[error] ${email}: ${e.message}`);
    }
  }

  console.log('\n── Summary ──');
  console.log(`Current employees checked: ${current.length}`);
  console.log(`Created:                   ${created}`);
  console.log(`Skipped (already had one): ${skippedExisting}`);
  console.log(`Skipped (no official email): ${skippedNoEmail}`);
  console.log(`Errors:                    ${errors.length}`);
}

main()
  .catch((err) => {
    console.error('Bulk create failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
