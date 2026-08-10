const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticate } = require('../middleware/authenticate');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  const INVALID = { success: false, error: 'Invalid email or password' };
  if (!user) return res.status(401).json(INVALID);

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return res.status(401).json(INVALID);

  if (!user.isActive) {
    return res.status(403).json({ success: false, error: 'This account has been disabled' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.json({ success: true, token: signToken(user), user: toPublicUser(user) });
}));

// GET /api/auth/me
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, error: 'Account no longer active' });
  }
  res.json({ success: true, user: toPublicUser(user) });
}));

// POST /api/auth/change-password
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new password are required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ success: true, message: 'Password updated successfully' });
}));

module.exports = router;
