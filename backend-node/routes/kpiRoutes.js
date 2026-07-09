const express = require("express");
const router = express.Router();
const KpiAssignment = require("../models/KpiAssignment");
const Onboarding = require("../models/onboardingModel");
const Exit = require("../models/exitModel");
const HiringRequisition = require("../models/HiringRequisition");

const MODULES = ["onboarding", "exit", "recruitment"];

// ─── Assignment label (who currently owns this process) ───────────────────

router.get("/assignments", async (req, res) => {
  try {
    const docs = await KpiAssignment.find({}).lean();
    const byModule = {};
    for (const m of MODULES) {
      const found = docs.find((d) => d.module === m);
      byModule[m] = { dept: found?.dept || "", designation: found?.designation || "" };
    }
    res.json({ success: true, data: byModule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/assignments/:module", async (req, res) => {
  try {
    const { module } = req.params;
    if (!MODULES.includes(module)) {
      return res.status(400).json({ success: false, message: "Unknown module" });
    }
    const { dept, designation } = req.body;
    const updated = await KpiAssignment.findOneAndUpdate(
      { module },
      { module, dept: dept || "", designation: designation || "" },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── On-time completion % ──────────────────────────────────────────────────
// Definition (confirmed with the person building this): % of tasks that
// were actually completed on time, out of tasks that have been completed
// at all (on-time + delayed) — tasks still pending/overdue/not-yet-due
// are excluded from the denominator since they haven't been completed
// either way yet. Status strings ("DONE", "DONE (DELAYED)", etc.) match
// the same convention already used across Onboarding/Exit/Recruitment
// checklist scoring.

function scoreFromChecklists(checklistGroups) {
  let onTime = 0;
  let delayed = 0;
  for (const group of checklistGroups || []) {
    for (const item of group.itemsList || []) {
      const status = (item.status || "").toUpperCase().trim();
      if (status === "DONE") onTime++;
      else if (status.includes("DELAYED")) delayed++;
    }
  }
  const completed = onTime + delayed;
  return { onTime, delayed, completed, pct: completed > 0 ? Math.round((onTime / completed) * 1000) / 10 : null };
}

function scoreFromFlatChecklist(items) {
  let onTime = 0;
  let delayed = 0;
  for (const item of items || []) {
    const status = (item.status || "").toUpperCase().trim();
    if (status === "DONE") onTime++;
    else if (status.includes("DELAYED")) delayed++;
  }
  const completed = onTime + delayed;
  return { onTime, delayed, completed, pct: completed > 0 ? Math.round((onTime / completed) * 1000) / 10 : null };
}

router.get("/scores", async (req, res) => {
  try {
    const [onboardingDocs, exitDocs, requisitionDocs] = await Promise.all([
      Onboarding.find({}, "checkLists").lean(),
      Exit.find({}, "checkLists").lean(),
      HiringRequisition.find({}, "checklist_tasks").lean(),
    ]);

    let onboardingAgg = { onTime: 0, delayed: 0 };
    for (const doc of onboardingDocs) {
      const r = scoreFromChecklists(doc.checkLists);
      onboardingAgg.onTime += r.onTime;
      onboardingAgg.delayed += r.delayed;
    }

    let exitAgg = { onTime: 0, delayed: 0 };
    for (const doc of exitDocs) {
      const r = scoreFromChecklists(doc.checkLists);
      exitAgg.onTime += r.onTime;
      exitAgg.delayed += r.delayed;
    }

    let recruitmentAgg = { onTime: 0, delayed: 0 };
    for (const doc of requisitionDocs) {
      const r = scoreFromFlatChecklist(doc.checklist_tasks);
      recruitmentAgg.onTime += r.onTime;
      recruitmentAgg.delayed += r.delayed;
    }

    const finalize = (agg) => {
      const completed = agg.onTime + agg.delayed;
      return {
        onTime: agg.onTime,
        delayed: agg.delayed,
        completed,
        pct: completed > 0 ? Math.round((agg.onTime / completed) * 1000) / 10 : null,
      };
    };

    res.json({
      success: true,
      data: {
        onboarding: finalize(onboardingAgg),
        exit: finalize(exitAgg),
        recruitment: finalize(recruitmentAgg),
      },
    });
  } catch (err) {
    console.error("[kpi/scores] error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Quarterly breakdown for one module ────────────────────────────────────
// Buckets by the date each task was actually COMPLETED (item.done), not
// when the record was created — this gives a genuine "how punctual were
// we that quarter" trend rather than lumping a record's whole lifetime
// into its creation quarter. Items never completed (still pending/
// overdue) don't have a done date and are excluded, same as the overall
// /scores endpoint.

function extractFlatItems(doc, moduleKey) {
  if (moduleKey === "recruitment") {
    return (doc.checklist_tasks || []).map((t) => ({ status: t.status, done: t.done, plan: t.plan }));
  }
  const out = [];
  for (const group of doc.checkLists || []) {
    for (const item of group.itemsList || []) {
      out.push({ status: item.status, done: item.doneDate, plan: item.planDate });
    }
  }
  return out;
}

function quarterOf(date) {
  const m = date.getMonth(); // 0-11
  if (m >= 3 && m <= 5) return "Q1";   // Apr-Jun
  if (m >= 6 && m <= 8) return "Q2";   // Jul-Sep
  if (m >= 9 && m <= 11) return "Q3";  // Oct-Dec
  return "Q4";                          // Jan-Mar
}

// Fiscal year (Apr-Mar) — Jan/Feb/Mar belong to the PREVIOUS fiscal year,
// e.g. Jan-Mar 2026 is "Q4 2025", not "Q4 2026".
function fiscalYearOf(date) {
  const m = date.getMonth();
  return m <= 2 ? date.getFullYear() - 1 : date.getFullYear();
}

// Parses the requisitioner's "21 May 24" style date strings — same format
// handled elsewhere in this codebase for sheet-imported date columns.
const MONTH_MAP = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
function parseRequestDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2,4})$/);
  if (m) {
    const mon = MONTH_MAP[m[2].toLowerCase()];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (mon !== undefined) {
      const d = new Date(Date.UTC(y, mon, +m[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  const fb = new Date(s);
  return isNaN(fb.getTime()) ? null : fb;
}

router.get("/scores-by-quarter", async (req, res) => {
  try {
    const moduleKey = req.query.module;
    if (!MODULES.includes(moduleKey)) {
      return res.status(400).json({ success: false, message: "Unknown module" });
    }

    const requestedYear = req.query.year ? Number(req.query.year) : null;

    // Recruitment is scored as ONE VERDICT PER REQUISITION (was the whole
    // hiring process on time overall?), not per checklist sub-task — since
    // in practice the 12-item checklist often isn't ticked even when the
    // overall requisition is closed. Onboarding/Exit stay task-level,
    // since their checklists genuinely are used day-to-day.
    if (moduleKey === "recruitment") {
      const docs = await HiringRequisition.find(
        {}, "done_in_time done_but_delayed tasks_overdue tasks_due not_yet_due request_date"
      ).lean();

      const emptyBucket = () => ({ onTime: 0, delayed: 0, overdue: 0, pending: 0 });
      const yearsFound = new Set();
      const perYearBuckets = {};

      for (const doc of docs) {
        const d = parseRequestDate(doc.request_date);
        if (!d) continue;

        const fy = fiscalYearOf(d);
        yearsFound.add(fy);
        if (!perYearBuckets[fy]) {
          perYearBuckets[fy] = { Q1: emptyBucket(), Q2: emptyBucket(), Q3: emptyBucket(), Q4: emptyBucket() };
        }
        const q = quarterOf(d);
        // Sum this requisition's already-computed task counts into the
        // quarter its request_date falls into — e.g. 15 requisitions each
        // with 8 done-in-time tasks contributes 8*15=120 to that quarter,
        // not just +1 per requisition.
        perYearBuckets[fy][q].onTime += doc.done_in_time || 0;
        perYearBuckets[fy][q].delayed += doc.done_but_delayed || 0;
        perYearBuckets[fy][q].overdue += doc.tasks_overdue || 0;
        perYearBuckets[fy][q].pending += (doc.tasks_due || 0) + (doc.not_yet_due || 0);
      }

      const availableYears = Array.from(yearsFound).sort((a, b) => b - a);
      const year = requestedYear || availableYears[0] || new Date().getFullYear();
      const yearBuckets = perYearBuckets[year] || { Q1: emptyBucket(), Q2: emptyBucket(), Q3: emptyBucket(), Q4: emptyBucket() };

      const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
        const b = yearBuckets[q];
        const completed = b.onTime + b.delayed;
        return {
          quarter: q,
          onTime: b.onTime,
          delayed: b.delayed,
          overdue: b.overdue,
          pending: b.pending,
          completed,
          pct: completed > 0 ? Math.round((b.onTime / completed) * 1000) / 10 : null,
        };
      });

      return res.json({ success: true, year, availableYears: availableYears.length ? availableYears : [year], quarters });
    }

    const Model = moduleKey === "onboarding" ? Onboarding : Exit;
    const projection = "checkLists";

    const docs = await Model.find({}, projection).lean();

    // Two separate flat lists: completed items bucket by when they were
    // actually DONE; overdue/pending items have no done date yet, so they
    // bucket by when they were PLANNED to be done instead — otherwise
    // there'd be no way to place them on the timeline at all.
    const completedFlat = [];
    const incompleteFlat = [];
    for (const doc of docs) {
      for (const item of extractFlatItems(doc, moduleKey)) {
        const status = (item.status || "").toUpperCase().trim();
        if (item.done) {
          const d = new Date(item.done);
          if (!isNaN(d.getTime())) completedFlat.push({ status, date: d });
        } else if (item.plan) {
          const d = new Date(item.plan);
          if (!isNaN(d.getTime())) incompleteFlat.push({ status, date: d });
        }
      }
    }

    const availableYears = Array.from(new Set([
      ...completedFlat.map((f) => fiscalYearOf(f.date)),
      ...incompleteFlat.map((f) => fiscalYearOf(f.date)),
    ])).sort((a, b) => b - a);
    const year = requestedYear || availableYears[0] || new Date().getFullYear();

    const emptyBucket = () => ({ onTime: 0, delayed: 0, overdue: 0, pending: 0 });
    const buckets = { Q1: emptyBucket(), Q2: emptyBucket(), Q3: emptyBucket(), Q4: emptyBucket() };

    for (const f of completedFlat) {
      if (fiscalYearOf(f.date) !== year) continue;
      const q = quarterOf(f.date);
      if (f.status === "DONE") buckets[q].onTime++;
      else if (f.status.includes("DELAYED")) buckets[q].delayed++;
    }
    for (const f of incompleteFlat) {
      if (fiscalYearOf(f.date) !== year) continue;
      const q = quarterOf(f.date);
      if (f.status === "OVERDUE") buckets[q].overdue++;
      else if (f.status === "PENDING" || f.status === "NOT YET DUE") buckets[q].pending++;
    }

    const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => {
      const b = buckets[q];
      const completed = b.onTime + b.delayed;
      return {
        quarter: q,
        onTime: b.onTime,
        delayed: b.delayed,
        overdue: b.overdue,
        pending: b.pending,
        completed,
        pct: completed > 0 ? Math.round((b.onTime / completed) * 1000) / 10 : null,
      };
    });

    res.json({ success: true, year, availableYears: availableYears.length ? availableYears : [year], quarters });
  } catch (err) {
    console.error("[kpi/scores-by-quarter] error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// ─── TEMPORARY DIAGNOSTIC — checks if Q4's spike is a real spread of
// dates, or suspicious clustering (many tasks sharing the exact same
// timestamp, like the Anshika Yadav case) ──────────────────────────────────
router.get("/debug-quarter-spike", async (req, res) => {
  try {
    const moduleKey = req.query.module || "onboarding";
    const Model = moduleKey === "recruitment" ? HiringRequisition : (moduleKey === "exit" ? Exit : Onboarding);
    const projection = moduleKey === "recruitment" ? "requisitioner_name checklist_tasks" : "name checkLists";
    const docs = await Model.find({}, projection).lean();

    const dateCounts = {};
    const sample = [];

    for (const doc of docs) {
      const items = moduleKey === "recruitment"
        ? (doc.checklist_tasks || []).map((t) => ({ status: t.status, done: t.done, task: t.task, docName: doc.requisitioner_name }))
        : (doc.checkLists || []).flatMap((g) => (g.itemsList || []).map((it) => ({ status: it.status, done: it.doneDate, task: it.name, docName: doc.name })));

      for (const item of items) {
        if (!item.done) continue;
        const d = new Date(item.done);
        if (isNaN(d.getTime())) continue;
        const m = d.getMonth();
        if (m < 0 || m > 2) continue; // only Jan-Mar (Q4)

        const key = d.toISOString();
        dateCounts[key] = (dateCounts[key] || 0) + 1;
        if (sample.length < 15) sample.push({ docName: item.docName, task: item.task, done: key, status: item.status });
      }
    }

    // Sort by how many tasks share each exact timestamp — real spread-out
    // data will have mostly 1s; suspicious clustering will show a handful
    // of timestamps with dozens/hundreds of tasks each.
    const topClusters = Object.entries(dateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([date, count]) => ({ date, count }));

    res.json({ success: true, totalQ4Items: Object.values(dateCounts).reduce((a, b) => a + b, 0), topClusters, sample });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ONE-OFF CORRECTION — remove after running once ────────────────────────
// Clears the 5 specific checklist items on Anshika Yadav's Onboarding
// record that got a bad future doneDate (2026-10-01), then fully
// recomputes that record's scoring/status fields using the same logic
// onboardingroutes.js already uses elsewhere (scoreChecklist), so the
// result is consistent with every other record rather than hand-patched.
router.post("/fix-anshika-future-dates", async (req, res) => {
  try {
    const Onboarding = require("../models/onboardingModel");
    const doc = await Onboarding.findOne({ name: "Anshika Yadav" }).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Record not found" });

    const targetTasks = new Set([
      "Verification Of Document Done?",
      "Check if UAN Applicable Done?",
      "UAN (PF) if applicable completed Done?",
      "KYC (PF) if applicable completed Done?",
      "Medical Insurance Card Issued if Applicable Done?",
    ]);

    let cleared = 0;
    const checkLists = (doc.checkLists || []).map((group) => ({
      ...group,
      itemsList: (group.itemsList || []).map((item) => {
        if (targetTasks.has(item.name) && item.doneDate) {
          cleared++;
          return { ...item, doneDate: null, checked: false };
        }
        return item;
      }),
    }));

    // Targeted update on just this one field — deliberately avoids
    // doc.save(), which would validate the ENTIRE document (including
    // unrelated legacy fields like managementLevel="" that predate that
    // field's enum being added) and fail for reasons that have nothing
    // to do with what we're actually fixing here.
    await Onboarding.findByIdAndUpdate(doc._id, { checkLists }, { runValidators: false });

    res.json({
      success: true,
      message: `Cleared ${cleared} item(s). Now call POST /api/onboarding/${doc._id}/resync to recompute scoring.`,
      id: doc._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TEMPORARY DEBUG ROUTE — remove once the future-date mystery is solved ──
// Uses the exact same query path as /scores-by-quarter (direct Mongoose
// query for the full checkLists field), so it's guaranteed to see
// whatever the chart is actually seeing — unlike the regular GET
// /api/onboarding list endpoint, which likely only returns summary
// fields for the table view and wouldn't have checkLists to search at all.
router.get("/debug-future-dates", async (req, res) => {
  try {
    const onboardingDocs = await Onboarding.find({}, "name checkLists").lean();
    const exitDocs = await Exit.find({}, "name checkLists").lean();
    const requisitionDocs = await HiringRequisition.find({}, "requisitioner_name checklist_tasks").lean();

    const cutoff = new Date("2026-10-01");
    const found = [];

    for (const doc of onboardingDocs) {
      for (const group of doc.checkLists || []) {
        for (const item of group.itemsList || []) {
          if (item.doneDate && new Date(item.doneDate) >= cutoff) {
            found.push({ module: "onboarding", name: doc.name, task: item.name, doneDate: item.doneDate, planDate: item.planDate, status: item.status });
          }
        }
      }
    }
    for (const doc of exitDocs) {
      for (const group of doc.checkLists || []) {
        for (const item of group.itemsList || []) {
          if (item.doneDate && new Date(item.doneDate) >= cutoff) {
            found.push({ module: "exit", name: doc.name, task: item.name, doneDate: item.doneDate, planDate: item.planDate, status: item.status });
          }
        }
      }
    }
    for (const doc of requisitionDocs) {
      for (const item of doc.checklist_tasks || []) {
        if (item.done && new Date(item.done) >= cutoff) {
          found.push({ module: "recruitment", name: doc.requisitioner_name, task: item.task, doneDate: item.done, planDate: item.plan, status: item.status });
        }
      }
    }

    res.json({ success: true, count: found.length, found });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});