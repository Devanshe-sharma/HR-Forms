// A revision counts as a PPO / full-time conversion when it recorded a
// category change landing on 'Employee' from a non-permanent starting
// category — the CTC jump there is a stipend-to-full-CTC conversion, not a
// real merit increment. Single source of truth, mirrored by
// isConversion in routes/salaryRevisions.js's analytics endpoint and
// isPpoRevision in frontend/src/pages/SalaryRevisionNew.tsx — keep all
// three in sync if this definition ever changes.
const PPO_SOURCE_CATEGORIES = ['Intern', 'Contract Based'];

function isPpoConversion(revision) {
  if (!PPO_SOURCE_CATEGORIES.includes(revision.previousCategory)) return false;
  if (revision.categoryChanged) return revision.newCategory === 'Employee';
  return revision.category === 'Employee';
}

module.exports = isPpoConversion;
