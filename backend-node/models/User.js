const mongoose = require('mongoose');
const { ROLES } = require('../config/roles');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'Employee' },
    employeeId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    // Set true for accounts created with a shared/temporary password (e.g.
    // the onboarding bulk-import script) — forces a real password before
    // the account can be used anywhere else in the app.
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
