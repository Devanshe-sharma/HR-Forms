const Onboarding = require('../models/onboardingModel');

const EXITED_STATUS_VALUES = new Set(['Left', 'Already Left']);

// Salary revisions don't store a manager email of their own. reviewerEmail
// on Onboarding (the Confirmations-era "reviewer" field) is the obvious
// first guess, but it's populated on almost nothing in practice (3 of 127
// active employees, checked directly) — reportingHead (a plain name
// string) is the field that's actually kept up to date across the app, so
// the real path here is: get the manager's NAME (reviewerName, else
// reportingHead, else whatever the revision itself already has recorded),
// then resolve THAT name to an email via a case-insensitive lookup against
// Onboarding — same pattern as resolveInterviewerEmail() in
// routes/applicantRecords.js.
async function resolveManagerContact(revision) {
  let name = revision.previousReportingHead || revision.newReportingHead || '';

  if (revision.onboardingId) {
    const employee = await Onboarding.findById(revision.onboardingId).select('reviewerName reportingHead').lean();
    name = employee?.reviewerName || employee?.reportingHead || name;
  }

  if (!name) return { name: '', email: null };

  // reportingHead/reviewerName is a plain name string, not a reference —
  // a real production case (two "Tanisha Sharma"s, one departed) already
  // sent a real escalation mail to a departed employee's old inbox because
  // a bare findOne() just grabbed whichever record came back first. Now:
  // exclude departed employees outright, and if more than one ACTIVE
  // person still shares the name, prefer whichever is in the same
  // department as the revision under review; log loudly either way so a
  // genuine ambiguity is visible instead of silently guessing.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = await Onboarding.find({ name: new RegExp(`^${escaped}$`, 'i') })
    .select('officialEmail persEmail exitStatus dept').lean();

  const active = candidates.filter((c) => !EXITED_STATUS_VALUES.has(c.exitStatus || ''));

  let pool = active;
  if (active.length > 1 && revision.department) {
    const sameDept = active.filter((c) => c.dept === revision.department);
    if (sameDept.length) pool = sameDept;
  }

  const manager = pool[0] || null;

  if (candidates.length > 1) {
    console.warn(
      `[resolveManagerContact] Ambiguous manager name "${name}" — ${candidates.length} Onboarding match(es) ` +
      `(${active.length} active). Picked: ${manager ? (manager.officialEmail || manager.persEmail) : '(none — all excluded)'}`
    );
  }

  return { name, email: manager?.officialEmail || manager?.persEmail || null };
}

module.exports = resolveManagerContact;
