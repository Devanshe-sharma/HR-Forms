const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ROLES, requireRole } = require('../config/roles');
const { authenticate } = require('../middleware/authenticate');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

router.use(authenticate, requireRole(['Admin']));

// GET /api/users
router.get('/', asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ success: true, data: users.map(toPublicUser) });
}));

// POST /api/users
router.post('/', asyncHandler(async (req, res) => {
  const { name, email, password, role, employeeId } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email and password are required' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ success: false, error: 'A user with this email already exists' });
  }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    role: role || 'Employee',
    employeeId: employeeId || null,
  });

  res.status(201).json({ success: true, data: toPublicUser(user) });
}));

// PATCH /api/users/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  const { name, role, isActive, employeeId } = req.body || {};

  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  if (name !== undefined) user.name = String(name).trim();
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = Boolean(isActive);
  if (employeeId !== undefined) user.employeeId = employeeId || null;

  await user.save();
  res.json({ success: true, data: toPublicUser(user) });
}));

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ success: true, message: 'Password reset successfully' });
}));

module.exports = router;
