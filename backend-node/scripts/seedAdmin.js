require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const name = process.env.ADMIN_NAME || 'Admin';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (optionally ADMIN_NAME) before running this script.');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`A user with email ${email} already exists (role: ${existing.role}). Nothing to do.`);
    return;
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'Admin',
  });

  console.log(`Created Admin user ${user.email} (${user._id}).`);
}

main()
  .catch(err => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
