// utils/roundPipeline.js
// ─────────────────────────────────────────────────────────────────────────────
// The fixed HR -> Technical -> Management interview pipeline (replaces the old
// free-text `stage` + separate screenerStatus screening step). A round only
// "passes" once it's been marked Done AND the interviewer's recommendation is
// in that round type's positive set — passing the HR round is what unlocks
// scheduling a Technical round, and passing Technical unlocks Management
// (mirrors the mockup's gateRound()).
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_TYPE_ORDER = ['hr', 'tech', 'mgmt'];

const ROUND_TYPE_LABELS = {
  hr: 'HR Round',
  tech: 'Technical Round',
  mgmt: 'Management Round',
};

// 'Select'/'Select with Conditions' only ever appear on a Management round,
// 'Recommended as P1/P2' only on HR/Technical — but both sets are checked
// against every roundType here for simplicity, since a mismatched value can
// never actually be saved for the wrong roundType (frontend only offers the
// relevant subset; nothing enforces it server-side today beyond that, so this
// stays permissive rather than silently rejecting a value from older data).
const POSITIVE_FEEDBACK_BY_TYPE = {
  hr:   ['Recommended as P1', 'Recommended as P2'],
  tech: ['Recommended as P1', 'Recommended as P2'],
  mgmt: ['Select', 'Select with Conditions'],
};

function roundLabel(roundType, roundNumber) {
  const base = ROUND_TYPE_LABELS[roundType] || roundType;
  return roundNumber > 1 ? `${base} ${roundNumber}` : base;
}

// True once ANY round of this type is Done with a positive recommendation —
// not necessarily the latest one, since HR may add a second HR round after a
// "Candidate on Hold" first round and only the later one actually passes.
function hasPassedRound(record, roundType) {
  const positive = POSITIVE_FEEDBACK_BY_TYPE[roundType] || [];
  return (record.interviewRounds || []).some(
    (r) => r.roundType === roundType && r.schedulingStatus === 'Done' && positive.includes(r.interviewerFeedbackStatus),
  );
}

function previousRoundType(roundType) {
  const i = ROUND_TYPE_ORDER.indexOf(roundType);
  return i > 0 ? ROUND_TYPE_ORDER[i - 1] : null;
}

function nextRoundType(roundType) {
  const i = ROUND_TYPE_ORDER.indexOf(roundType);
  return i >= 0 && i < ROUND_TYPE_ORDER.length - 1 ? ROUND_TYPE_ORDER[i + 1] : null;
}

// Whether a new round of `roundType` may be added right now — the HR round
// has no prerequisite; Technical/Management each require the round before it
// to have already passed.
function canAddRound(record, roundType) {
  const prev = previousRoundType(roundType);
  return !prev || hasPassedRound(record, prev);
}

module.exports = {
  ROUND_TYPE_ORDER,
  ROUND_TYPE_LABELS,
  roundLabel,
  hasPassedRound,
  previousRoundType,
  nextRoundType,
  canAddRound,
};
