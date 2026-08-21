const User = require('../models/User');
const Employee = require('../models/Employee');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * If a login User account's email exactly matches oldEmail, updates it to
 * newEmail. No-op if there's no matching account, or if the email didn't
 * actually change. Never creates or deletes accounts — only updates an
 * account that already exists under the old address.
 */
async function syncUserEmailOnChange(oldEmail, newEmail) {
  const from = String(oldEmail || '').trim().toLowerCase();
  const to = String(newEmail || '').trim().toLowerCase();
  if (!from || !to || from === to) return null;

  const user = await User.findOne({ email: from });
  if (!user) return null;

  user.email = to;
  await user.save();
  console.log(`[UserSync] Login email updated: ${from} -> ${to} (user ${user._id})`);
  return user;
}

/**
 * Onboarding is the master record for email. If an Employee record's
 * official_email exactly matches oldEmail (case-insensitive — unlike User,
 * Employee data isn't normalized to lowercase), updates it to newEmail.
 * No-op if there's no matching Employee, or if the email didn't change.
 */
async function syncEmployeeEmailOnChange(oldEmail, newEmail) {
  const from = String(oldEmail || '').trim();
  const to = String(newEmail || '').trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return null;

  const employee = await Employee.findOne({
    official_email: new RegExp(`^${escapeRegExp(from)}$`, 'i'),
  });
  if (!employee) return null;

  employee.official_email = to;
  await employee.save();
  console.log(`[EmployeeSync] Employee official_email updated: ${from} -> ${to} (employee ${employee._id})`);
  return employee;
}

module.exports = { syncUserEmailOnChange, syncEmployeeEmailOnChange };
