const Onboarding = require('../models/onboardingModel');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// Resolves a plain employee NAME (as stored in fields like reportingHead)
// to their email, via a case-insensitive lookup against Onboarding — same
// pattern as resolveManagerContact.js (used for Salary Revision manager
// escalation emails). Excludes departed employees outright, and when more
// than one active person shares the name, prefers whichever is in
// preferDept; logs loudly on genuine ambiguity instead of silently
// guessing — a real production case (two "Tanisha Sharma"s, one departed)
// once sent an email to a departed employee's old inbox from a bare
// findOne() that just grabbed whichever record came back first.
async function resolveEmployeeEmailByName(name, { preferDept } = {}) {
  if (!name) return null;

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = await Onboarding.find({ name: new RegExp(`^${escaped}$`, 'i') })
    .select('officialEmail persEmail exitStatus dept').lean();

  const active = candidates.filter((c) => !EXITED_STATUS_VALUES.has(c.exitStatus || ''));

  let pool = active;
  if (active.length > 1 && preferDept) {
    const sameDept = active.filter((c) => c.dept === preferDept);
    if (sameDept.length) pool = sameDept;
  }

  const match = pool[0] || null;

  if (candidates.length > 1) {
    console.warn(
      `[resolveEmployeeEmailByName] Ambiguous name "${name}" — ${candidates.length} Onboarding match(es) ` +
      `(${active.length} active). Picked: ${match ? (match.officialEmail || match.persEmail) : '(none — all excluded)'}`
    );
  }

  return match?.officialEmail || match?.persEmail || null;
}

module.exports = resolveEmployeeEmailByName;
