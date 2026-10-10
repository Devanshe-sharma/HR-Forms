// utils/candidateEvents.js
// ─────────────────────────────────────────────────────────────────────────────
// Appends (or updates) one entry on an ApplicantRecord's `events` array — the
// data behind the Timeline & History tab. Call this at the moment of a real
// transition (screener decision, round scheduled/completed/feedback, stage
// change, offer/joining events), passing the record (a Mongoose document,
// not a .lean() object, since this pushes onto the array in place — the
// caller is still responsible for calling .save()).
//
// `key` is a stable id (e.g. "stg-Shortlisted", "hr1-scheduled") — passing
// the same key again UPDATES that entry in place instead of duplicating it,
// the same convention the rest of this codebase uses for "sticky" one-time
// state (see resolveOneTimeEmails pattern in routes/onboardingroutes.js).
// ─────────────────────────────────────────────────────────────────────────────

function addEvent(record, key, label, detail) {
  if (!record.events) record.events = [];
  const existing = record.events.find((e) => e.key === key);
  if (existing) {
    existing.label = label;
    existing.when = new Date();
    if (detail !== undefined) existing.detail = detail;
    return existing;
  }
  const entry = { key, label, when: new Date(), detail: detail || '' };
  record.events.push(entry);
  return entry;
}

module.exports = { addEvent };
