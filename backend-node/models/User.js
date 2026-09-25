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
    // When the password was last set (by the user themselves or an Admin
    // reset) — lets Admin verify a reset actually took effect, since
    // lastLoginAt/updatedAt don't reliably indicate a password change.
    passwordChangedAt: { type: Date, default: null },
    // Embedded in every JWT issued at login and re-checked on every
    // authenticated request (see middleware/authenticate.js). Bumping this
    // (POST /api/auth/force-logout-all, Admin-only) makes every
    // already-issued token fail its next request, forcing a fresh login —
    // used to force everyone to re-login and pass through a new gate (e.g.
    // profile-completion) without waiting for each token's own expiry.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
