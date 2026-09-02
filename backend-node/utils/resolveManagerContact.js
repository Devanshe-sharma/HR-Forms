const Onboarding = require('../models/onboardingModel');

// Salary revisions don't store a manager email of their own — the
// "Reviewer" fields on the linked Onboarding record are the same person
// used elsewhere (Confirmations) as the employee's reporting manager, so
// this reuses that instead of inventing a second manager-contact concept.
async function resolveManagerContact(revision) {
  if (!revision.onboardingId) {
    return { name: revision.previousReportingHead || revision.newReportingHead || '', email: null };
  }
  const employee = await Onboarding.findById(revision.onboardingId).select('reviewerName reviewerEmail').lean();
  return {
    name: employee?.reviewerName || revision.previousReportingHead || revision.newReportingHead || '',
    email: employee?.reviewerEmail || null,
  };
}

module.exports = resolveManagerContact;
