require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const email = (process.env.RESET_EMAIL || '').trim().toLowerCase();
  const password = process.env.RESET_PASSWORD || '';

  if (!email || !password) {
    console.error('Set RESET_EMAIL and RESET_PASSWORD before running this script.');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('RESET_PASSWORD must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email });
  if (!user) {
    console.log(`No user found with email ${email}.`);
    return;
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();
  console.log(`Password reset for ${user.email} (role: ${user.role}).`);
}

main()
  .catch(err => {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
