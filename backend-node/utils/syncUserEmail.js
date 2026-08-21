const User = require('../models/User');

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

module.exports = { syncUserEmailOnChange };
