// scripts/migrateToFixedRoundPipeline.js
// ─────────────────────────────────────────────────────────────────────────────
// One-off migration to the fixed HR -> Technical -> Management interview
// pipeline (see utils/roundPipeline.js). Idempotent — safe to re-run; already
// migrated rounds (roundType already set) are left untouched.
//
// For each ApplicantRecord:
//   1. If a legacy screenerStatus decision exists and no 'hr'-typed round
//      exists yet, synthesize one (Done, feedback/interviewer carried over,
//      hrBackground left blank — no historical data for those fields).
//   2. Every pre-migration interviewRounds entry (no roundType yet) gets one
//      assigned from its old free-text `stage`:
//        /^Technical Round/i -> 'tech'
//        'CEO Round' / 'MD Round' -> 'mgmt'
//        'Assessment (if any)' or anything unrecognized -> 'tech', FLAGGED
//        (an addEvent on the record) for manual HR review, since it doesn't
//        map cleanly.
//   3. roundNumber is recomputed sequentially per roundType, ordered by
//      scheduledDate (falling back to createdAt) so round ordering stays sane.
//
// Usage:
//   node scripts/migrateToFixedRoundPipeline.js --dry-run   (prints summary only)
//   node scripts/migrateToFixedRoundPipeline.js --apply     (writes changes)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const mongoose = require('mongoose');
const ApplicantRecord = require('../models/ApplicantRecord');
const { addEvent } = require('../utils/candidateEvents');
const { roundLabel } = require('../utils/roundPipeline');

const SCREENER_STATUS_TO_FEEDBACK = {
  'Shortlisted': 'Recommended as P1',
  'Rejected': 'Not Recommended',
  'Candidate On Hold': 'Candidate on Hold',
  'Profile On Hold': 'Candidate on Hold',
};

function classifyLegacyStage(stage) {
  if (/^Technical Round/i.test(stage || '')) return { roundType: 'tech', flagged: false };
  if (stage === 'CEO Round' || stage === 'MD Round') return { roundType: 'mgmt', flagged: false };
  // 'Assessment (if any)' or blank/unrecognized — closest bucket is
  // Technical, but flagged since it isn't a clean mapping.
  return { roundType: 'tech', flagged: true, original: stage || '(blank)' };
}

async function migrateRecord(record, apply, tally) {
  let changed = false;

  // ── 1. Synthesize an HR round from the legacy screener decision ──────────
  const hasHrRound = (record.interviewRounds || []).some((r) => r.roundType === 'hr');
  if (!hasHrRound && record.screenerStatus) {
    const feedback = SCREENER_STATUS_TO_FEEDBACK[record.screenerStatus] || '';
    record.interviewRounds.unshift({
      roundType: 'hr',
      roundNumber: 1,
      stage: roundLabel('hr', 1),
      schedulingStatus: 'Done',
      interviewer: record.screenerName || '',
      feedback: record.screenerNotes || '',
      interviewerFeedbackStatus: feedback,
    });
    tally.hrSynthesized++;
    changed = true;
  }

  // ── 2. Classify every pre-migration round (no roundType yet) ─────────────
  let flaggedAny = false;
  (record.interviewRounds || []).forEach((r) => {
    if (r.roundType) return; // already migrated
    const { roundType, flagged, original } = classifyLegacyStage(r.stage);
    r.roundType = roundType;
    tally.remapped[roundType] = (tally.remapped[roundType] || 0) + 1;
    if (flagged) {
      flaggedAny = true;
      tally.flagged.push({ candidateId: String(record._id), name: record.full_name, originalStage: original });
    }
    changed = true;
  });

  // ── 3. Recompute roundNumber sequentially per roundType ──────────────────
  ['hr', 'tech', 'mgmt'].forEach((type) => {
    const rounds = (record.interviewRounds || [])
      .filter((r) => r.roundType === type)
      .sort((a, b) => {
        const da = a.scheduledDate ? new Date(a.scheduledDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const db = b.scheduledDate ? new Date(b.scheduledDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return da - db;
      });
    rounds.forEach((r, i) => {
      const n = i + 1;
      if (r.roundNumber !== n) { r.roundNumber = n; changed = true; }
      const label = roundLabel(type, n);
      if (!r.stage) { r.stage = label; changed = true; }
    });
  });

  if (flaggedAny) {
    addEvent(record, 'migration-reclassified-rounds', 'Round(s) Reclassified During Pipeline Migration', 'One or more rounds could not be cleanly mapped to HR/Technical/Management — please review.');
    changed = true;
  }

  if (changed) {
    tally.candidatesChanged++;
    if (apply) await record.save();
  }

  return changed;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dryRun = !apply;

  await mongoose.connect(process.env.MONGO_URI);

  const records = await ApplicantRecord.find({});
  const tally = { hrSynthesized: 0, remapped: {}, flagged: [], candidatesChanged: 0, saveErrors: [] };

  for (const record of records) {
    try {
      await migrateRecord(record, apply, tally);
    } catch (e) {
      // A record with pre-existing unrelated data corruption (e.g. a round
      // with a now-invalid enum value from before a schema change) shouldn't
      // block every other candidate's migration — skip it and report it.
      tally.saveErrors.push({ candidateId: String(record._id), name: record.full_name, error: e.message });
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Migration summary — ${records.length} candidate(s) scanned`);
  console.log(`  Candidates changed:         ${tally.candidatesChanged}`);
  console.log(`  HR rounds synthesized:      ${tally.hrSynthesized}`);
  console.log(`  Rounds remapped by type:    ${JSON.stringify(tally.remapped)}`);
  console.log(`  Flagged for manual review:  ${tally.flagged.length}`);
  if (tally.flagged.length) {
    console.log('  Flagged candidates:');
    tally.flagged.forEach((f) => console.log(`    - ${f.name} (${f.candidateId}) — original stage: "${f.originalStage}"`));
  }
  if (tally.saveErrors.length) {
    console.log(`  Skipped due to pre-existing unrelated data errors: ${tally.saveErrors.length}`);
    tally.saveErrors.forEach((f) => console.log(`    - ${f.name} (${f.candidateId}) — ${f.error}`));
  }
  if (dryRun) {
    console.log('\nThis was a dry run — no changes were written. Re-run with --apply to commit.');
  } else {
    console.log('\nChanges written.');
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
