const Onboarding = require('../models/onboardingModel');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// Same convention as resolveManagerContact.js (Salary Revision's version)
// — Confirmations already stores the manager's NAME directly
// (reportingManager, kept fresh by refreshSnapshot()), so this just
// resolves that name to an email via Onboarding, with the same
// disambiguation-by-department safety net for a shared name.
async function resolveConfirmationManagerContact(record) {
  const name = record.reportingManager || '';
  if (!name) return { name: '', email: null };

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = await Onboarding.find({ name: new RegExp(`^${escaped}$`, 'i') })
    .select('officialEmail persEmail exitStatus dept').lean();

  const active = candidates.filter((c) => !EXITED_STATUS_VALUES.has(c.exitStatus || ''));

  let pool = active;
  if (active.length > 1 && record.department) {
    const sameDept = active.filter((c) => c.dept === record.department);
    if (sameDept.length) pool = sameDept;
  }

  const manager = pool[0] || null;

  if (candidates.length > 1) {
    console.warn(
      `[resolveConfirmationManagerContact] Ambiguous manager name "${name}" — ${candidates.length} Onboarding match(es) ` +
      `(${active.length} active). Picked: ${manager ? (manager.officialEmail || manager.persEmail) : '(none — all excluded)'}`
    );
  }

  return { name, email: manager?.officialEmail || manager?.persEmail || null };
}

module.exports = resolveConfirmationManagerContact;
