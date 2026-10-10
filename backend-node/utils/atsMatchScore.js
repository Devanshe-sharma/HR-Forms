// utils/atsMatchScore.js
// ─────────────────────────────────────────────────────────────────────────────
// Deterministic ATS match score (0-100) for a candidate against the
// requisition they applied for — a different, automatic concept from the
// on-demand AI `ai_fit_score` (which stays untouched, see ApplicantRecord.js).
// No API cost, always current, recomputed on create and on edit of any input
// field (see call sites in routes/applicantRecords.js and
// routes/candidateApplications.js).
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  skills:   40,
  experience: 25,
  location: 20,
  notice:   15,
};

function normalizeSkill(s) {
  return String(s || '').trim().toLowerCase();
}

// Fraction (0-1) of the requisition's required skills the candidate's own
// skills list covers — substring-aware both ways so "React" matches
// "React.js" and vice versa.
function skillsMatch(candidateSkills, requiredSkills) {
  const req = (requiredSkills || []).map(normalizeSkill).filter(Boolean);
  if (!req.length) return 0.5; // no requirement on file — neutral, not a penalty
  const cand = (candidateSkills || []).map(normalizeSkill).filter(Boolean);
  if (!cand.length) return 0;
  const hits = req.filter((r) => cand.some((c) => c.includes(r) || r.includes(c)));
  return hits.length / req.length;
}

// Parses a free-text "total_experience" string like "4 years" / "4" / "4.5"
// into a number of years, or null if unparseable.
function parseYears(v) {
  if (v == null || v === '') return null;
  const m = String(v).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function experienceMatch(candidateType, totalExperience, requiredLevel) {
  const years = parseYears(totalExperience);
  if (requiredLevel === 'Fresher') {
    // A fresher role — anyone with 0-2 years is a fine match, more
    // experience isn't a bad thing but isn't the target either.
    if (candidateType === 'Fresher' || years == null) return 1;
    return years <= 2 ? 1 : 0.6;
  }
  if (requiredLevel === 'Experienced') {
    if (years == null) return candidateType === 'Fresher' ? 0.2 : 0.5;
    if (years >= 2) return 1;
    if (years >= 1) return 0.6;
    return 0.3;
  }
  // No experience level specified on the requisition — neutral.
  return 0.5;
}

function locationMatch(candidateCity, candidateState, relocation, baseLocation, remoteEligible) {
  if (remoteEligible) return 1;
  if (!baseLocation) return 0.5; // nothing to compare against
  const base = baseLocation.toLowerCase();
  const near = [candidateCity, candidateState].filter(Boolean).some((v) => base.includes(String(v).toLowerCase()) || String(v).toLowerCase().includes(base));
  if (near) return 1;
  const willing = String(relocation || '').toLowerCase().startsWith('y');
  return willing ? 0.7 : 0.2;
}

function noticeMatch(noticePeriod) {
  const m = String(noticePeriod || '').match(/(\d+)/);
  if (!m) return 0.5;
  const days = parseInt(m[1], 10);
  if (days <= 15) return 1;
  if (days <= 30) return 0.8;
  if (days <= 60) return 0.5;
  return 0.3;
}

// candidate: plain object/lean doc with primarySkills, secondarySkills,
// candidateType, total_experience, city, state, relocation, notice_period.
// requisition: plain object/lean doc (or null if none matched) with
// required_skills, candidate_experience_level, base_location, remote_eligible.
function computeAtsMatchScore(candidate, requisition) {
  const skills = [...(candidate.primarySkills || []), ...(candidate.secondarySkills || [])];
  const parts = {
    skills: skillsMatch(skills, requisition && requisition.required_skills),
    experience: experienceMatch(candidate.candidateType, candidate.total_experience, requisition && requisition.candidate_experience_level),
    location: locationMatch(candidate.city, candidate.state, candidate.relocation, requisition && requisition.base_location, requisition && requisition.remote_eligible),
    notice: noticeMatch(candidate.notice_period),
  };
  const score = Object.keys(WEIGHTS).reduce((sum, k) => sum + parts[k] * WEIGHTS[k], 0);
  return Math.round(score);
}

module.exports = { computeAtsMatchScore };
