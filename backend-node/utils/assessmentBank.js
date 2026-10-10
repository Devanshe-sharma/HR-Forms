// utils/assessmentBank.js
// ─────────────────────────────────────────────────────────────────────────────
// Static question banks for the Excel Test and DISC Assessment. Both are
// genuinely administered (no fabricated results) — Excel answers are
// free-text, collected for HR to grade manually (see excelTestSchema in
// ApplicantRecord.js: formula correctness can't be reliably auto-graded);
// DISC is a real forced-choice questionnaire, scored from the candidate's
// own picks via scoreDisc() below.
// ─────────────────────────────────────────────────────────────────────────────

// Candidate submits one free-text answer per question; HR marks each
// correct/incorrect afterward via POST /:id/assessments/excel/grade.
const EXCEL_QUESTIONS = [
  'Describe how you would use VLOOKUP or XLOOKUP to fetch a value from another sheet.',
  'Describe the steps to build a Pivot Table summarising sales by region.',
  'Write an IF formula that checks multiple conditions.',
  'Describe how you would apply conditional formatting to highlight duplicate values.',
  'Write a SUMIFS formula that totals a column based on two criteria.',
];

// 12-item forced-choice DISC questionnaire — each item offers one
// word/phrase per trait (D/I/S/C); the candidate picks the ONE that
// describes them best. Scoring just tallies picks per trait across all 12
// items, so the DB-stored score is a genuine 0-100% derived straight from
// the candidate's own answers (see scoreDisc below), not a canned result.
const DISC_QUESTIONS = [
  { D: 'Direct', I: 'Enthusiastic', S: 'Patient', C: 'Precise' },
  { D: 'Decisive', I: 'Persuasive', S: 'Steady', C: 'Careful' },
  { D: 'Competitive', I: 'Talkative', S: 'Dependable', C: 'Analytical' },
  { D: 'Bold', I: 'Sociable', S: 'Calm', C: 'Systematic' },
  { D: 'Driven', I: 'Expressive', S: 'Supportive', C: 'Accurate' },
  { D: 'Blunt', I: 'Optimistic', S: 'Loyal', C: 'Reserved' },
  { D: 'Assertive', I: 'Charming', S: 'Easygoing', C: 'Methodical' },
  { D: 'Demanding', I: 'Inspiring', S: 'Consistent', C: 'Detail-oriented' },
  { D: 'Independent', I: 'Outgoing', S: 'Team-player', C: 'Logical' },
  { D: 'Results-focused', I: 'Spontaneous', S: 'Relaxed', C: 'Cautious' },
  { D: 'Confident', I: 'Friendly', S: 'Good listener', C: 'Organised' },
  { D: 'Risk-taker', I: 'Energetic', S: 'Peacemaker', C: 'Rule-follower' },
];

// answers: array of 12 single-letter picks, e.g. ['D','I','S','D',...] — one
// per DISC_QUESTIONS item, in order. Returns { scores: {D,I,S,C}, primary }.
function scoreDisc(answers) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  (answers || []).forEach((pick) => {
    if (scores[pick] !== undefined) scores[pick]++;
  });
  const total = DISC_QUESTIONS.length || 1;
  Object.keys(scores).forEach((k) => {
    scores[k] = Math.round((scores[k] / total) * 100);
  });
  const primary = Object.keys(scores).reduce((best, k) => (scores[k] > scores[best] ? k : best), 'D');
  return { scores, primary };
}

module.exports = { EXCEL_QUESTIONS, DISC_QUESTIONS, scoreDisc };
