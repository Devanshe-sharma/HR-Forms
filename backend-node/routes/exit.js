const express = require("express");
const Exit = require("../models/exitModel");
// Onboarding's own schema already has an unused "exitStatus" field —
// syncing into it here makes Onboarding the single master employee list
// (with current exit status baked in) instead of needing a live join
// between the two collections every time someone views the dashboard.
const Onboarding = require("../models/onboardingModel");

const router = express.Router();

// Email triggers are optional at this stage — wire these up in ../emails
// when the exit email templates are ported over. Defensive require so the
// route file works standalone until then.
let triggerNewExit = () => Promise.resolve();
let triggerUpdateExit = () => Promise.resolve();
try {
  const emailsModule = require("../emails");
  if (emailsModule.triggerNewExit) triggerNewExit = emailsModule.triggerNewExit;
  if (emailsModule.triggerUpdateExit) triggerUpdateExit = emailsModule.triggerUpdateExit;
} catch (e) {
  // emails module not required for Exit yet — safe to ignore
}

// ─── One-time email fields (flag + timestamp pairs) ─────────────────────────
const EXIT_EMAIL_FIELDS = [
  ["autoExitEmail", "autoExitEmailSentAt"],
  ["autoExitEmailDept", "autoExitEmailDeptSentAt"],
  ["autoReminderEmail", "autoReminderEmailSentAt"],
  ["autoInstructionsToAllEmail", "autoInstructionsToAllEmailSentAt"],
];

// These checkboxes can legitimately need to fire MORE than once for the
// same record — e.g. "autoExitEmail" sends the "Acceptance" email while
// Serving Notice Period, and a completely different farewell email once
// they're Already Left/Left. A sticky "only ever once" rule would silently
// block the second send. So: fires every time the checkbox is ticked on a
// given submit, matching the original Apps Script's behavior (it just
// checked the box fresh each time). SentAt is still recorded — just as
// "when did this last send," not as a block on sending again.
function resolveOneTimeExitEmails(existing, body) {
  const resolved = {};
  const newlyTriggered = {};
  for (const [flagField, sentAtField] of EXIT_EMAIL_FIELDS) {
    const requestedNow = !!body[flagField];
    resolved[flagField] = requestedNow;
    resolved[sentAtField] = requestedNow
      ? new Date()
      : (existing ? existing[sentAtField] : null);
    newlyTriggered[flagField] = requestedNow;
  }
  return { resolved, newlyTriggered };
}

// ─── Scoring helper (identical logic to Onboarding's, plus the same
// approval gate HiringRequisition now has) ──────────────────────────────────
// isApproved defaults to true so every existing call site that doesn't
// pass it explicitly keeps behaving exactly as before — only the specific
// call sites that were deliberately updated below (create, update,
// approve) actually pass isApproved through based on the record's real
// hr_approved_at state.
function scoreChecklist(list, today, isApproved = true) {
  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
      tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

  // Nothing scores at all until HR has actually approved the exit —
  // every item sits in "Awaiting Approval", no score, not counted as
  // overdue/pending. Still counted toward tasksNotDone (it genuinely
  // isn't done), which is what keeps fmsStatus correctly Open rather
  // than accidentally auto-closing just because nothing's been scored.
  if (!isApproved) {
    for (const item of list.itemsList) {
      item.score = 0;
      item.status = "AWAITING APPROVAL";
      item.daysLeft = null;
      notYetDue++;
      tasksNotDone++;
    }
    return { doneInTime, doneButDelayed, tasksOverdue, tasksDue, notYetDue, fmsScore, tasksNotDone };
  }

  for (const item of list.itemsList) {
    const planDate = item.planDate instanceof Date ? item.planDate : null;
    const doneDate = item.doneDate instanceof Date ? item.doneDate : null;

    if (planDate && !isNaN(planDate.getTime())) {
      const daysDiff = Math.round((planDate.getTime() - today.getTime()) / 86_400_000);

      if (doneDate && !isNaN(doneDate.getTime())) {
        const score = Math.round((planDate.getTime() - doneDate.getTime()) / 86_400_000);
        item.score = score;
        item.daysLeft = null;
        if (score < 0) { item.status = "DONE (DELAYED)"; doneButDelayed++; fmsScore += score; }
        else { item.status = "DONE"; doneInTime++; }
      } else {
        if (daysDiff < 0) {
          item.score = daysDiff; item.status = "OVERDUE"; item.daysLeft = daysDiff;
          tasksOverdue++; fmsScore += daysDiff; tasksNotDone++;
        } else {
          item.score = 0; item.status = "PENDING"; item.daysLeft = daysDiff;
          tasksDue++; tasksNotDone++;
        }
      }
    } else {
      if (doneDate) {
        item.score = 0; item.status = "DONE"; item.daysLeft = null; doneInTime++;
      } else {
        item.score = 0; item.status = "NOT YET DUE"; item.daysLeft = null;
        notYetDue++; tasksNotDone++;
      }
    }
  }

  return { doneInTime, doneButDelayed, tasksOverdue, tasksDue, notYetDue, fmsScore, tasksNotDone };
}

// ─── Build the 3 default checklist groups (matches createFmsObject() exactly) ──
function buildDefaultCheckLists() {
  return [
    {
      name: "PRE-EXIT TASKS",
      itemsList: [
        { name: "Exit Email Done?" },
        { name: "Reminder Email Done?" },
        { name: "Take a Printout of Exit Email Done?" },
        { name: "Exit Email to All Dept Cc Done?" },
        { name: "Get a Handing Over Done from Employee?" },
        { name: "Conducting Exit Interview with Mgmt Done?" },
      ],
    },
    {
      name: "EXIT-DAY TASKS",
      itemsList: [
        { name: "Sign Exit Form Done?" },
        { name: "Sign No Dues Certificate Done?" },
        { name: "Ensure All Assets Are Returned Done?" },
        { name: "Name Deleted from Employee List Done?" },
        { name: "Tea Party Done?" },
      ],
    },
    {
      name: "POST-EXIT TASKS",
      itemsList: [
        { name: "Close the Contract on Odoo Done?" },
        { name: "Reassign Assets Done?" },
        { name: "Sent an Approval Mail to Mgmt Done?" },
        { name: "Issue FnF Salary Done?" },
        { name: "Issue Experience Letter Done?" },
        { name: "Reallotment of Delegation & Checklist Task Done?" },
        { name: "Remove Email from Google Drive Done?" },
        { name: "Remove Biometric Access Done?" },
        { name: "Change S2ndLife Password Done?" },
        { name: "Remove ERP Password Done?" },
        { name: "Archive Employee Profile Done?" },
        { name: "Remove the Access from Shared Contacts Done?" },
        { name: "Delete Email from BO Domain Done?" },
        { name: "Remove Employee from BO WhatsApp Gp Done?" },
      ],
    },
  ];
}

// ─── Assign plan dates — hybrid base per group ──────────────────────────────
// PRE-EXIT TASKS (send exit email, check references, etc.) CAN happen
// during someone's notice period, so they're based on approvalDate + 5
// days — counting from when HR actually reviewed the exit, not from
// something that hasn't happened yet.
//
// EXIT-DAY TASKS (sign exit form, tea party, return assets) are due ON
// the actual last day itself — leftDate (once known) or plannedExitDate
// as a fallback estimate while still serving notice, +0 days.
//
// POST-EXIT TASKS (FnF salary, deactivate accounts, experience letter)
// get 5 days of grace after that same anchor date to actually complete
// the wrap-up work once the person is gone.
function assignExitPlanDates(checkLists, approvalDate, leftDate, plannedExitDate) {
  for (const list of checkLists) {
    let base, offsetDays;

    if (list.name === "PRE-EXIT TASKS") {
      base = approvalDate ? new Date(approvalDate) : null;
      offsetDays = 5;
    } else if (list.name === "EXIT-DAY TASKS") {
      base = (leftDate || plannedExitDate) ? new Date(leftDate || plannedExitDate) : null;
      offsetDays = 0;
    } else {
      // POST-EXIT TASKS
      base = (leftDate || plannedExitDate) ? new Date(leftDate || plannedExitDate) : null;
      offsetDays = 5;
    }

    if (base && !isNaN(base.getTime())) {
      const planDate = new Date(base);
      planDate.setDate(planDate.getDate() + offsetDays);
      list.planDate = planDate;
      for (const item of list.itemsList) item.planDate = planDate;
    }
  }
}

// ─── Safely turn a Mongoose checklist array into clean plain objects ───────
// Never spread Mongoose (sub)documents directly — see Onboarding's routes
// for the exact bug this avoids (silently dropped fields on save).
function toPlainCheckLists(checkLists) {
  return (checkLists || []).map((l) => ({
    name: l.name,
    planDate: l.planDate ?? null,
    itemsList: (l.itemsList || []).map((it) => ({
      name: it.name ?? "",
      planDate: it.planDate ?? null,
      doneDate: it.doneDate ?? null,
      score: it.score ?? 0,
      status: it.status ?? "Pending",
      daysLeft: it.daysLeft ?? 0,
      checked: !!it.checked,
    })),
  }));
}

// Reconciles an existing record's checklist against the CURRENT
// buildDefaultCheckLists() template — used whenever a new task gets added
// to the checklist definitions after records already exist. Matches items
// by NAME (not array position), so it's safe regardless of where in the
// list a new task was inserted: existing items keep all their done/plan
// data untouched, and any task present in the template but missing from
// the record gets added fresh (inheriting the group's plan date, if any,
// so it scores consistently with its siblings).
function reconcileChecklistsWithTemplate(existingCheckLists) {
  const template = buildDefaultCheckLists();
  const existingByGroupName = new Map((existingCheckLists || []).map((g) => [g.name, g]));

  return template.map((templateGroup) => {
    const existingGroup = existingByGroupName.get(templateGroup.name);
    const existingItemsByName = new Map(
      (existingGroup?.itemsList || []).map((it) => [it.name, it])
    );

    return {
      name: templateGroup.name,
      planDate: existingGroup?.planDate ?? null,
      itemsList: templateGroup.itemsList.map(({ name: itemName }) => {
        const existingItem = existingItemsByName.get(itemName);
        if (existingItem) {
          return {
            name: existingItem.name ?? itemName,
            planDate: existingItem.planDate ?? null,
            doneDate: existingItem.doneDate ?? null,
            score: existingItem.score ?? 0,
            status: existingItem.status ?? "Pending",
            daysLeft: existingItem.daysLeft ?? 0,
            checked: !!existingItem.checked,
          };
        }
        return {
          name: itemName,
          planDate: existingGroup?.planDate ?? null,
          doneDate: null,
          score: 0,
          status: "Pending",
          daysLeft: 0,
          checked: false,
        };
      }),
    };
  });
}

function normalizeCc(raw) {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function deriveFmsStatus(exitStatus, tasksNotDone) {
  if (["Left", "Not Exiting", "Exit Cancelled"].includes(exitStatus)) return "Closed";
  return tasksNotDone === 0 ? "Closed" : "Open";
}

// ─── Sync exit status onto the matching Onboarding record ──────────────────
// Matched primarily by PERSONAL email, not official email. Official
// addresses (like hr.head@company.com) are often role-based and get reused
// for whoever currently holds that position — e.g. when a new HR Head
// joins after the previous one left, they can share the exact same
// official email despite being two different people. Personal email is
// genuinely unique to the individual, so it's the reliable match key.
// Falls back to official email (with a rehire-date safety check) only when
// personal email is missing on either side.
//
// Latest-exit resolution: a person can have MULTIPLE exit records over
// time — an exit that got cancelled ("Not Exiting") followed by a genuine
// later exit, or a real re-exit after a rehire. Whichever record happens
// to trigger this sync call, always resolve to whichever of that person's
// exit records is chronologically LATEST (by leftDate > plannedExitDate >
// resignationDate) before writing the status — otherwise an older event
// processed later in a loop can silently overwrite the correct current
// status with stale data.
//
// Rehire-aware fallback: if matching by official email, and the matched
// Onboarding record's joinedDate is AFTER the latest exit's own date, that
// exit predates their current employment stint — skip rather than marking
// someone exited while currently employed.
//
// Best-effort — never throws, so a sync hiccup never blocks an exit from
// being saved.
function exitDateOf(e) {
  const d = e.leftDate || e.plannedExitDate || e.resignationDate || null;
  const t = d ? new Date(d).getTime() : NaN;
  return isNaN(t) ? -Infinity : t;
}

async function syncExitStatusToOnboarding(exitDoc) {
  try {
    const persEmail = (exitDoc.persEmail || "").trim().toLowerCase();
    const officialEmail = (exitDoc.officialEmail || "").trim().toLowerCase();
    if (!persEmail && !officialEmail) return;

    const candidates = await Onboarding.find({}, "officialEmail persEmail joinedDate").lean();

    let match = null;
    let matchedVia = null;
    if (persEmail) {
      match = candidates.find((o) => (o.persEmail || "").trim().toLowerCase() === persEmail);
      if (match) matchedVia = "persEmail";
    }
    if (!match && officialEmail) {
      match = candidates.find((o) => (o.officialEmail || "").trim().toLowerCase() === officialEmail);
      if (match) matchedVia = "officialEmail";
    }
    if (!match) return;

    // Find every exit record sharing the same identifying email, and use
    // whichever one is truly the latest — not just the one that triggered
    // this call.
    const allExits = await Exit.find(
      {},
      "persEmail officialEmail exitStatus leftDate plannedExitDate resignationDate"
    ).lean();
    const sameIdentityExits = allExits.filter((e) => {
      if (matchedVia === "persEmail") {
        return (e.persEmail || "").trim().toLowerCase() === persEmail;
      }
      return (e.officialEmail || "").trim().toLowerCase() === officialEmail;
    });
    const latestExit = sameIdentityExits.reduce(
      (latest, e) => (!latest || exitDateOf(e) > exitDateOf(latest) ? e : latest),
      null
    ) || exitDoc;

    if (matchedVia === "officialEmail" && match.joinedDate) {
      const exitTime = exitDateOf(latestExit);
      const joinedTime = new Date(match.joinedDate).getTime();
      if (!isNaN(joinedTime) && exitTime !== -Infinity && joinedTime > exitTime) {
        // They've since rejoined after their latest exit — currently
        // employed, don't mark this old exit as their status.
        return;
      }
    }

    const finalExitStatus = latestExit.exitStatus || "";
    const setFields = { exitStatus: finalExitStatus };
    // No point tracking onboarding tasks for someone who's actually gone —
    // "Serving Notice Period" is still employed, and "Not
    // Exiting"/"Exit Cancelled" mean they never left, so only these two
    // values close it out.
    if (["Left", "Already Left"].includes(finalExitStatus)) {
      setFields.fmsStatus = "Closed";
    }

    await Onboarding.findByIdAndUpdate(match._id, setFields);
  } catch (err) {
    console.error("Onboarding exitStatus sync failed:", err.message);
  }
}

// ─── POST /api/exit  — Create new exit ────────────────────────────────────
// New exits start UNAPPROVED — checklist plan dates are NOT assigned at
// all yet (assignExitPlanDates is skipped entirely, same as
// HiringRequisition seeding with no milestones), and every item scores as
// "Awaiting Approval" until PATCH /:id/approve happens.
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const checkLists = buildDefaultCheckLists();

    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        const submittedItems = submittedList.items || submittedList.itemsList || [];
        submittedItems.forEach((item, itemIdx) => {
          const target = checkLists[listIdx]?.itemsList?.[itemIdx];
          if (!target) return;
          const isChecked = typeof item === "boolean" ? item : item?.checked;
          if (isChecked) {
            target.checked = true;
            target.doneDate = new Date();
          }
        });
      });
    }

    // assignExitPlanDates deliberately NOT called here — nothing has a
    // meaningful plan date until approval happens.

    const today = new Date();
    let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
        tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

    const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);

    for (const list of checkLists) {
      const r = scoreChecklist(list, today, false); // isApproved: false
      doneInTime += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue += r.tasksOverdue;
      tasksDue += r.tasksDue;
      notYetDue += r.notYetDue;
      fmsScore += r.fmsScore;
      tasksNotDone += r.tasksNotDone;
    }

    const fmsStatus = deriveFmsStatus(body.exitStatus, tasksNotDone);
    const { resolved: emailFields, newlyTriggered } = resolveOneTimeExitEmails(null, body);

    const doc = new Exit({
      ...body,
      ...emailFields,
      hr_approved_at: null,
      resignationDate: body.resignationDate ? new Date(body.resignationDate) : undefined,
      plannedExitDate: body.plannedExitDate ? new Date(body.plannedExitDate) : undefined,
      leftDate: body.leftDate ? new Date(body.leftDate) : undefined,
      joiningDate: body.joiningDate ? new Date(body.joiningDate) : undefined,
      employeesInCc: normalizeCc(body.employeesInCc),
      checkLists,
      totalTasks,
      doneInTime,
      doneButDelayed,
      tasksOverdue,
      tasksDue,
      notYetDue,
      fmsScore,
      fmsStatus,
    });

    await doc.save();
    // Merge newlyTriggered over the saved doc so triggerNewExit only sends
    // emails whose flag was newly set THIS call — not every sticky-true
    // flag from prior calls.
    triggerNewExit({ ...doc.toObject(), ...newlyTriggered }).catch(console.error);
    syncExitStatusToOnboarding(doc).catch(console.error);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/exit/:id/approve — HR's explicit approval action ──────────
// Every checklist item stays gated at "Awaiting Approval" until this
// happens. The delay between record creation and approval is added as an
// EXTRA offset on top of the fixed +5/+15 day windows (see
// assignExitPlanDates) — resignationDate and leftDate themselves are never
// touched, since those are real, factual dates, not internal targets.
router.patch("/:id/approve", async (req, res) => {
  try {
    const doc = await Exit.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    if (doc.hr_approved_at) {
      return res.status(400).json({ success: false, message: "This exit has already been approved." });
    }

    const now = new Date();
    doc.hr_approved_at = now;

    const checkLists = toPlainCheckLists(doc.toObject().checkLists);
    assignExitPlanDates(checkLists, now, doc.leftDate, doc.plannedExitDate);

    const today = new Date();
    let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
        tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

    for (const list of checkLists) {
      const r = scoreChecklist(list, today, true); // isApproved: true
      doneInTime += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue += r.tasksOverdue;
      tasksDue += r.tasksDue;
      notYetDue += r.notYetDue;
      fmsScore += r.fmsScore;
      tasksNotDone += r.tasksNotDone;
    }

    doc.checkLists = checkLists;
    doc.totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
    doc.doneInTime = doneInTime;
    doc.doneButDelayed = doneButDelayed;
    doc.tasksOverdue = tasksOverdue;
    doc.tasksDue = tasksDue;
    doc.notYetDue = notYetDue;
    doc.fmsScore = fmsScore;
    doc.fmsStatus = deriveFmsStatus(doc.exitStatus, tasksNotDone);

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/exit  — List all ────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const docs = await Exit.find().sort({ fmsStatus: 1, createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/exit/sync-diagnostics ─────────────────────────────────────────
// Full per-record breakdown: which Onboarding record each exit matched to,
// which email did the matching, whether the rehire-date check skipped it,
// and what exitStatus is actually stored on the matched Onboarding record
// right now. Registered before /:id for the same reason as /unsynced.
// ─── POST /api/exit/reconcile-checklist-template ───────────────────────────
// Backfills any checklist task that's been added to buildDefaultCheckLists()
// since a record was created — e.g. adding "Remove Employee from BO
// WhatsApp Gp Done?" to POST-EXIT TASKS. Existing items are matched by
// name and left completely untouched; only genuinely missing tasks get
// added. Safe to re-run anytime, including after future task additions.
router.post("/reconcile-checklist-template", async (req, res) => {
  try {
    const docs = await Exit.find();
    let updated = 0;

    for (const existing of docs) {
      const existingPlain = existing.toObject();
      const checkLists = reconcileChecklistsWithTemplate(existingPlain.checkLists);
      const isApproved = !!existing.hr_approved_at;

      const today = new Date();
      let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
          tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

      for (const list of checkLists) {
        const r = scoreChecklist(list, today, isApproved);
        doneInTime += r.doneInTime;
        doneButDelayed += r.doneButDelayed;
        tasksOverdue += r.tasksOverdue;
        tasksDue += r.tasksDue;
        notYetDue += r.notYetDue;
        fmsScore += r.fmsScore;
        tasksNotDone += r.tasksNotDone;
      }

      const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
      const fmsStatus = deriveFmsStatus(existing.exitStatus, tasksNotDone);

      await Exit.findByIdAndUpdate(existing._id, {
        checkLists, totalTasks, doneInTime, doneButDelayed,
        tasksOverdue, tasksDue, notYetDue, fmsScore, fmsStatus,
      });
      updated++;
    }

    res.json({ success: true, message: `Reconciled checklist template on ${updated} exit record(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/sync-diagnostics", async (req, res) => {
  try {
    const exits = await Exit.find(
      {},
      "name officialEmail persEmail exitStatus leftDate plannedExitDate resignationDate"
    ).lean();
    const candidates = await Onboarding.find(
      {},
      "name officialEmail persEmail exitStatus joinedDate"
    ).lean();

    const report = exits.map((e) => {
      const persEmail = (e.persEmail || "").trim().toLowerCase();
      const officialEmail = (e.officialEmail || "").trim().toLowerCase();

      const byPersEmail = persEmail
        ? candidates.find((o) => (o.persEmail || "").trim().toLowerCase() === persEmail)
        : null;
      const byOfficialEmail = !byPersEmail && officialEmail
        ? candidates.find((o) => (o.officialEmail || "").trim().toLowerCase() === officialEmail)
        : null;

      const matched = byPersEmail || byOfficialEmail;
      const matchedVia = byPersEmail ? "persEmail" : byOfficialEmail ? "officialEmail" : null;

      // Same "latest exit wins" resolution the real sync uses — a person
      // can have multiple exit records (e.g. a cancelled exit followed by
      // a genuine later one).
      const sameIdentityExits = matchedVia
        ? exits.filter((x) =>
            matchedVia === "persEmail"
              ? (x.persEmail || "").trim().toLowerCase() === persEmail
              : (x.officialEmail || "").trim().toLowerCase() === officialEmail
          )
        : [e];
      const latestExit = sameIdentityExits.reduce(
        (latest, x) => (!latest || exitDateOf(x) > exitDateOf(latest) ? x : latest),
        null
      ) || e;
      const isLatestForThisPerson = latestExit === e;

      let rehireSkipped = false;
      const latestExitDateVal = latestExit.leftDate || latestExit.plannedExitDate || latestExit.resignationDate || null;
      if (matchedVia === "officialEmail" && matched?.joinedDate && latestExitDateVal) {
        const joinedTime = new Date(matched.joinedDate).getTime();
        const exitTime = new Date(latestExitDateVal).getTime();
        if (!isNaN(joinedTime) && !isNaN(exitTime) && joinedTime > exitTime) {
          rehireSkipped = true;
        }
      }

      return {
        exitName: e.name,
        exitStatusInExitRecord: e.exitStatus || "",
        exitPersEmail: e.persEmail || "",
        exitOfficialEmail: e.officialEmail || "",
        exitDateUsed: e.leftDate || e.plannedExitDate || e.resignationDate || null,
        matched: !!matched,
        matchedVia,
        matchedOnboardingId: matched ? String(matched._id) : null,
        matchedOnboardingName: matched ? matched.name : null,
        matchedOnboardingJoinedDate: matched ? matched.joinedDate : null,
        multipleExitRecordsForThisPerson: sameIdentityExits.length > 1,
        isLatestExitForThisPerson: isLatestForThisPerson,
        latestExitStatusForThisPerson: latestExit.exitStatus || "",
        rehireSkipped,
        currentExitStatusStoredOnOnboarding: matched ? (matched.exitStatus || "") : null,
      };
    });

    res.json({ success: true, count: report.length, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/exit/unsynced ─────────────────────────────────────────────────
// Shows exactly which exit records did NOT get matched to an Onboarding
// record during the last sync, and why — so you can tell "this person
// never had an Onboarding entry" apart from "their emails just don't match
// between the two records" instead of guessing. Must be registered BEFORE
// the /:id route below, or Express matches "unsynced" as an :id instead.
router.get("/unsynced", async (req, res) => {
  try {
    const exits = await Exit.find({}, "name officialEmail persEmail exitStatus").lean();
    const candidates = await Onboarding.find({}, "name officialEmail persEmail exitStatus").lean();

    const results = exits.map((e) => {
      const persEmail = (e.persEmail || "").trim().toLowerCase();
      const officialEmail = (e.officialEmail || "").trim().toLowerCase();

      const byPersEmail = persEmail
        ? candidates.find((o) => (o.persEmail || "").trim().toLowerCase() === persEmail)
        : null;
      const byOfficialEmail = !byPersEmail && officialEmail
        ? candidates.find((o) => (o.officialEmail || "").trim().toLowerCase() === officialEmail)
        : null;

      const matched = byPersEmail || byOfficialEmail;
      let reason = null;
      if (!matched) {
        if (!persEmail && !officialEmail) reason = "Exit record has no email at all";
        else reason = "No Onboarding record found with a matching personal or official email";
      }

      return {
        exitName: e.name,
        exitPersEmail: e.persEmail || "",
        exitOfficialEmail: e.officialEmail || "",
        matched: !!matched,
        matchedVia: byPersEmail ? "persEmail" : byOfficialEmail ? "officialEmail" : null,
        matchedOnboardingName: matched ? matched.name : null,
        currentExitStatusOnOnboarding: matched ? (matched.exitStatus || "") : null,
        reasonUnmatched: reason,
      };
    });

    const unsynced = results.filter((r) => !r.matched);

    res.json({
      success: true,
      totalExits: exits.length,
      matchedCount: results.length - unsynced.length,
      unsyncedCount: unsynced.length,
      unsynced,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/exit/analytics/asked-to-leave ────────────────────────────────
// Aggregate-only: percentage of exits that were "Asked to Leave", out of
// all real exits (excludes "Not Exiting"/"Exit Cancelled", which never
// actually happened). Deliberately projects ONLY exitType/exitStatus — never
// name, dept, reasonAskedToLeave, or reasonAskedToLeaveDetail. No
// department breakdown either: in a small department, "3 of 3 asked to
// leave" is as identifying as a name, so this stays a single organization-
// wide number.
// Must be registered before /:id, same reason as /unsynced above.
const REAL_EXIT_STATUSES = new Set(["Serving Notice Period", "Already Left", "Left"]);

router.get("/analytics/asked-to-leave", async (req, res) => {
  try {
    const docs = await Exit.find({}, "exitType exitStatus").lean();
    const realExits = docs.filter((d) => REAL_EXIT_STATUSES.has(d.exitStatus || ""));

    const totalExits = realExits.length;
    const askedToLeaveCount = realExits.filter((d) => d.exitType === "Asked to Leave").length;
    const askedToLeavePct = totalExits > 0 ? Math.round((askedToLeaveCount / totalExits) * 1000) / 10 : 0;

    res.json({ success: true, totalExits, askedToLeaveCount, askedToLeavePct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/exit/:id  — Single record with full checklists ─────────────
router.get("/:id", async (req, res) => {
  try {
    const doc = await Exit.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/exit/:id  — Update exit ─────────────────────────────────────
// assignExitPlanDates + real scoring only run if the record is ALREADY
// approved. An unapproved record just keeps getting scored as "Awaiting
// Approval" through every update until PATCH /:id/approve actually
// happens — updating other fields on it doesn't sneak it past the gate.
router.put("/:id", async (req, res) => {
  try {
    const body = req.body;
    const existing = await Exit.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    const isApproved = !!existing.hr_approved_at;

    const existingPlain = existing.toObject();
    const checkLists = toPlainCheckLists(existingPlain.checkLists);

    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        const submittedItems = submittedList.items || submittedList.itemsList || [];
        submittedItems.forEach((item, itemIdx) => {
          const target = checkLists[listIdx]?.itemsList?.[itemIdx];
          if (!target) return;
          const isNewlyTicked = !!item?.checked && item?.name === "new";
          if (isNewlyTicked && !target.doneDate) {
            target.checked = true;
            target.doneDate = new Date();
          }
        });
      });
    }

    const resolvedExitStatus = body.exitStatus ?? existing.exitStatus ?? "";
    const resolvedResignationDate = body.resignationDate ? new Date(body.resignationDate) : existing.resignationDate;
    const resolvedLeftDate = body.leftDate ? new Date(body.leftDate) : existing.leftDate;
    const resolvedPlannedExitDate = body.plannedExitDate ? new Date(body.plannedExitDate) : existing.plannedExitDate;
    const resolvedJoiningDate = body.joiningDate ? new Date(body.joiningDate) : existing.joiningDate;

    if (isApproved) {
      assignExitPlanDates(checkLists, existing.hr_approved_at, resolvedLeftDate, resolvedPlannedExitDate);
    }

    const today = new Date();
    let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
        tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

    for (const list of checkLists) {
      const r = scoreChecklist(list, today, isApproved);
      doneInTime += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue += r.tasksOverdue;
      tasksDue += r.tasksDue;
      notYetDue += r.notYetDue;
      fmsScore += r.fmsScore;
      tasksNotDone += r.tasksNotDone;
    }

    const fmsStatus = deriveFmsStatus(resolvedExitStatus, tasksNotDone);
    const { resolved: emailFields, newlyTriggered } = resolveOneTimeExitEmails(existingPlain, body);

    const updated = await Exit.findByIdAndUpdate(
      req.params.id,
      {
        ...body,
        ...emailFields,
        exitStatus: resolvedExitStatus,
        resignationDate: resolvedResignationDate,
        plannedExitDate: resolvedPlannedExitDate,
        leftDate: resolvedLeftDate,
        joiningDate: resolvedJoiningDate,
        employeesInCc: body.employeesInCc !== undefined ? normalizeCc(body.employeesInCc) : existing.employeesInCc,
        checkLists,
        totalTasks: checkLists.reduce((s, l) => s + l.itemsList.length, 0),
        doneInTime,
        doneButDelayed,
        tasksOverdue,
        tasksDue,
        notYetDue,
        fmsScore,
        fmsStatus,
      },
      { new: true, runValidators: true }
    );

    // Same principle as create — only send emails whose flag was newly
    // set this call, never re-send a sticky-true flag from before.
    triggerUpdateExit({ ...updated.toObject(), ...newlyTriggered }).catch(console.error);
    syncExitStatusToOnboarding(updated).catch(console.error);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/exit/close-before-date ──────────────────────────────────────
// One-time bulk action: closes fmsStatus on every exit record whose actual
// exit date falls before the given cutoff. "Actual exit date" is resolved
// the same way syncExitStatusToOnboarding() already does via exitDateOf()
// — leftDate, falling back to plannedExitDate, falling back to
// resignationDate — rather than a single fixed field, since which of
// those three is populated varies by exitStatus. Doesn't touch checklist
// data, exitStatus, or anything else — just flips fmsStatus, since these
// are old exits no longer being actively tracked.
//
// Body (optional): { date: "YYYY-MM-DD" } — defaults to 2026-05-31 (i.e.
// "before 31 May") if omitted. A record with no resolvable exit date at
// all (exitDateOf returns -Infinity) is left untouched rather than closed
// — there's nothing to compare against the cutoff, so silently closing it
// would be a guess, not a fact.
router.post("/close-before-date", async (req, res) => {
  try {
    const cutoff = req.body?.date ? new Date(req.body.date) : new Date("2026-05-31T23:59:59.999Z");
    if (isNaN(cutoff.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }

    const docs = await Exit.find(
      { fmsStatus: { $ne: "Closed" } },
      "leftDate plannedExitDate resignationDate fmsStatus"
    );

    let closed = 0;
    for (const doc of docs) {
      const exitTime = exitDateOf(doc);
      if (exitTime !== -Infinity && exitTime < cutoff.getTime()) {
        doc.fmsStatus = "Closed";
        await doc.save();
        closed++;
      }
    }

    res.json({
      success: true,
      message: `Closed ${closed} exit(s) with an exit date before ${cutoff.toISOString().slice(0, 10)}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/exit/:id ──────────────────────────────────────────────────
// ============================================================
// ONE-TIME LEGACY CSV IMPORT (old Google Sheet exit export)
// ============================================================
// The old sheet's checklist task names don't match ours exactly (typos,
// abbreviations) and dates come in three different formats across
// columns. This maps everything explicitly rather than guessing.

const { parse: parseCsv } = require("csv-parse/sync");

const EXIT_MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLegacyExitDate(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "NA") return null;

  // "DD/MM/YYYY" — used in the checklist Plan?/Done? columns
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    if (!isNaN(d.getTime())) return d;
  }

  // "DD MMM YY" — used for Left Date / Planned Exit Date
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2,4})$/);
  if (m) {
    const mon = EXIT_MONTH_MAP[m[2].toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined) {
      const d = new Date(Date.UTC(year, mon, parseInt(m[1], 10)));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // "MMM D, YYYY" — used for Resignation Email Sent on
  m = s.match(/^([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const mon = EXIT_MONTH_MAP[m[1].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[2], 10)));
      if (!isNaN(d.getTime())) return d;
    }
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Maps each canonical checklist item (same order as buildDefaultCheckLists())
// to the legacy sheet's own base column name, since several don't match
// exactly (typos/abbreviations in the original sheet).
const LEGACY_TASK_BASE_MAP = [
  [ // PRE-EXIT TASKS
    "Exit Email",
    "Reminder Email",
    "Take a Printout of exit Email",
    "Exit Email to All Dept Cc",
    "Get a Handing Over Done from Empl",
    "Conducting Exit Interview with Mgmt",
  ],
  [ // EXIT-DAY TASKS
    "Sign Exit Form",
    "Sign No Dues Certificate",
    "Ensure all Assets are Ruturned",
    "Name Deleted from Empl List",
    "Tea Party",
  ],
  [ // POST-EXIT TASKS
    "Close the Contract on Odoo",
    "Reassign Assets",
    "Sent an Approval Mail to Mgmt",
    "Issue FnF Salary",
    "Issue Experience Letter",
    "Realloment of Delegation & Checklist Task",
    "Remove Email from Google Drive",
    "Remove Biometric Access",
    "ChangeS2ndLife Password",
    "Remove ERP Password",
    "Archive Employee Profile",
    "Remove the Access from Shared Contacts",
    "Delete Email From BO Domain",
  ],
];

function buildLegacyExitChecklists(row) {
  const template = buildDefaultCheckLists();
  let hasAnyTaskData = false;

  const checkLists = template.map((group, listIdx) => ({
    name: group.name,
    planDate: null,
    itemsList: group.itemsList.map(({ name: itemName }, itemIdx) => {
      const legacyBase = LEGACY_TASK_BASE_MAP[listIdx][itemIdx];
      const planRaw = row[`${legacyBase} Plan?`];
      const doneRaw = row[`${legacyBase} Done?`];

      if ((planRaw && planRaw.trim()) || (doneRaw && doneRaw.trim())) hasAnyTaskData = true;

      const planDate = parseLegacyExitDate(planRaw);
      const doneDate = parseLegacyExitDate(doneRaw);

      return {
        name: itemName,
        planDate,
        doneDate,
        score: 0,
        status: "Pending",
        daysLeft: 0,
        checked: !!doneDate,
      };
    }),
  }));

  return { checkLists, hasAnyTaskData };
}

function toStrOrEmpty(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

// ─── POST /api/exit/migrate/import-legacy-csv ──────────────────────────────
// Body: { csv: "<raw CSV file contents as a string>" }
// Safe to re-run: skips any row whose name+officialEmail combo already
// exists in the collection.
//
// Legacy rows predate the approval gate entirely — treated as
// already-approved (hr_approved_at = the best available date on the row:
// leftDate, falling back to resignationDate, falling back to now), same
// reasoning as HiringRequisition's backfill route.
router.post("/migrate/import-legacy-csv", async (req, res) => {
  try {
    const csvText = req.body?.csv;
    if (!csvText || typeof csvText !== "string") {
      return res.status(400).json({ success: false, message: "Provide { csv: \"<file contents>\" } in the request body" });
    }

    const records = parseCsv(csvText, { columns: true, skip_empty_lines: true, trim: false });

    let imported = 0, skipped = 0;

    for (const row of records) {
      const name = toStrOrEmpty(row["Name of Person Being Exit"]);
      const officialEmail = toStrOrEmpty(row["Official Email"]);
      if (!name) { skipped++; continue; }

      const dup = await Exit.findOne({ name, officialEmail }).lean();
      if (dup) { skipped++; continue; }

      const { checkLists, hasAnyTaskData } = buildLegacyExitChecklists(row);

      let totalTasks = 0, doneInTime = 0, doneButDelayed = 0,
          tasksOverdue = 0, tasksDue = 0, notYetDue = 0, fmsScore = 0;

      if (hasAnyTaskData) {
        const today = new Date();
        let tasksNotDone = 0;
        for (const list of checkLists) {
          const r = scoreChecklist(list, today, true); // legacy — treated as already approved
          doneInTime += r.doneInTime;
          doneButDelayed += r.doneButDelayed;
          tasksOverdue += r.tasksOverdue;
          tasksDue += r.tasksDue;
          notYetDue += r.notYetDue;
          fmsScore += r.fmsScore;
          tasksNotDone += r.tasksNotDone;
        }
        totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
      }

      const exitStatus = toStrOrEmpty(row["Exit Status"]);
      const rawFmsStatus = toStrOrEmpty(row["FMS Status"]);
      const fmsStatus = rawFmsStatus
        ? (rawFmsStatus.toLowerCase() === "closed" ? "Closed" : "Open")
        : deriveFmsStatus(exitStatus, hasAnyTaskData ? tasksDue + tasksOverdue + notYetDue : 0);

      const resignationDate = parseLegacyExitDate(row["Resignation Email Sent on"]);
      const leftDate = parseLegacyExitDate(row["Left Date"]);
      const approvalDate = leftDate || resignationDate || new Date();

      const doc = new Exit({
        name,
        hr_approved_at: approvalDate,
        persEmail: toStrOrEmpty(row["Personal Email"]),
        mobile: toStrOrEmpty(row["Mobile"]),
        officialEmail,
        gender: toStrOrEmpty(row["Gender"]),
        dept: toStrOrEmpty(row["Dept"]),
        designation: toStrOrEmpty(row["Designation"]),
        deptLink: toStrOrEmpty(row["DeptLink"]),
        designationLink: toStrOrEmpty(row["DesignationLink"]),
        noticePeriod: toStrOrEmpty(row["Notice Period"]),
        transferKnowledge: toStrOrEmpty(row["You Will transfer Knowledge to"]),
        remarks: toStrOrEmpty(row["Remarks"]),
        exitType: toStrOrEmpty(row["Exit Type"]),
        exitStatus,
        resignationDate,
        plannedExitDate: parseLegacyExitDate(row["Planned Exit Date"]),
        leftDate,
        employeesInCc: normalizeCc(row["Employees In Cc"]),
        checkLists: hasAnyTaskData ? checkLists : [],
        totalTasks,
        doneInTime,
        doneButDelayed,
        tasksOverdue,
        tasksDue,
        notYetDue,
        fmsScore,
        fmsStatus,
      });

      await doc.save();
      await syncExitStatusToOnboarding(doc);
      imported++;
    }

    res.json({ success: true, message: `Imported ${imported} exit(s), skipped ${skipped} (missing name or already imported)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Every top-level field the current schema actually declares ───────────
// Anything on a raw imported document that ISN'T in this list gets removed
// once transformed, so no leftover raw CSV column names linger.
const EXIT_SCHEMA_FIELD_WHITELIST = new Set([
  "_id", "__v", "createdAt", "updatedAt", "hr_approved_at",
  "rowNo", "name", "gender", "persEmail", "mobile", "officialEmail", "dept", "designation",
  "dept_id", "desig_id", "deptLink", "designationLink", "noticePeriod", "transferKnowledge",
  "reason", "remarks", "exitType", "resignationDate", "plannedExitDate", "leftDate", "exitStatus",
  "employeesInCc", "totalTasks", "doneInTime", "doneButDelayed", "tasksDue", "tasksOverdue",
  "notYetDue", "fmsScore", "fmsStatus",
  "autoExitEmail", "autoExitEmailSentAt", "autoExitEmailDept", "autoExitEmailDeptSentAt",
  "autoReminderEmail", "autoReminderEmailSentAt",
  "autoInstructionsToAllEmail", "autoInstructionsToAllEmailSentAt",
  "checkLists",
]);

// ─── POST /api/exit/migrate/legacy-import ──────────────────────────────────
// For records inserted DIRECTLY into MongoDB (mongoimport / Compass CSV
// import), bypassing this API entirely. Those documents land with the raw
// CSV column names as field names ("Name of Person Being Exit", etc.),
// which Mongoose silently ignores — so they show up blank on the dashboard
// even though the data is really there. This transforms each matching
// document IN PLACE (same _id) into the schema's real shape, then removes
// the old keys. Safe to re-run — matches only documents that still have
// the raw "Name of Person Being Exit" field.
//
// Same "legacy predates approval gate" treatment as the CSV import above.
router.post("/migrate/legacy-import", async (req, res) => {
  try {
    const rawDocs = await Exit.collection.find({ "Name of Person Being Exit": { $exists: true } }).toArray();
    let migrated = 0;

    for (const rawDoc of rawDocs) {
      const name = toStrOrEmpty(rawDoc["Name of Person Being Exit"]);
      const exitStatus = toStrOrEmpty(rawDoc["Exit Status"]);
      const rawFmsStatus = toStrOrEmpty(rawDoc["FMS Status"]);

      const { checkLists, hasAnyTaskData } = buildLegacyExitChecklists(rawDoc);

      let totalTasks = 0, doneInTime = 0, doneButDelayed = 0,
          tasksOverdue = 0, tasksDue = 0, notYetDue = 0, fmsScore = 0;

      if (hasAnyTaskData) {
        const today = new Date();
        for (const list of checkLists) {
          const r = scoreChecklist(list, today, true); // legacy — treated as already approved
          doneInTime += r.doneInTime;
          doneButDelayed += r.doneButDelayed;
          tasksOverdue += r.tasksOverdue;
          tasksDue += r.tasksDue;
          notYetDue += r.notYetDue;
          fmsScore += r.fmsScore;
        }
        totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
      }

      const fmsStatus = rawFmsStatus
        ? (rawFmsStatus.toLowerCase() === "closed" ? "Closed" : "Open")
        : deriveFmsStatus(exitStatus, hasAnyTaskData ? tasksDue + tasksOverdue + notYetDue : 0);

      const resignationDate = parseLegacyExitDate(rawDoc["Resignation Email Sent on"]);
      const leftDate = parseLegacyExitDate(rawDoc["Left Date"]);
      const approvalDate = leftDate || resignationDate || new Date();

      const setFields = {
        name,
        hr_approved_at: approvalDate,
        persEmail: toStrOrEmpty(rawDoc["Personal Email"]),
        mobile: toStrOrEmpty(rawDoc["Mobile"]),
        officialEmail: toStrOrEmpty(rawDoc["Official Email"]),
        gender: toStrOrEmpty(rawDoc["Gender"]),
        dept: toStrOrEmpty(rawDoc["Dept"]),
        designation: toStrOrEmpty(rawDoc["Designation"]),
        deptLink: toStrOrEmpty(rawDoc["DeptLink"]),
        designationLink: toStrOrEmpty(rawDoc["DesignationLink"]),
        noticePeriod: toStrOrEmpty(rawDoc["Notice Period"]),
        transferKnowledge: toStrOrEmpty(rawDoc["You Will transfer Knowledge to"]),
        remarks: toStrOrEmpty(rawDoc["Remarks"]),
        exitType: toStrOrEmpty(rawDoc["Exit Type"]),
        exitStatus,
        resignationDate,
        plannedExitDate: parseLegacyExitDate(rawDoc["Planned Exit Date"]),
        leftDate,
        employeesInCc: normalizeCc(rawDoc["Employees In Cc"]),
        checkLists: hasAnyTaskData ? checkLists : [],
        totalTasks,
        doneInTime,
        doneButDelayed,
        tasksOverdue,
        tasksDue,
        notYetDue,
        fmsScore,
        fmsStatus,
      };

      const unsetFields = {};
      for (const key of Object.keys(rawDoc)) {
        if (!EXIT_SCHEMA_FIELD_WHITELIST.has(key)) unsetFields[key] = "";
      }

      await Exit.collection.updateOne(
        { _id: rawDoc._id },
        { $set: setFields, $unset: unsetFields }
      );
      await syncExitStatusToOnboarding({
        officialEmail: setFields.officialEmail,
        persEmail: setFields.persEmail,
        name: setFields.name,
        exitStatus: setFields.exitStatus,
        leftDate: setFields.leftDate,
        plannedExitDate: setFields.plannedExitDate,
        resignationDate: setFields.resignationDate,
      });
      migrated++;
    }

    res.json({ success: true, message: `Migrated ${migrated} legacy exit record(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/exit/sync-onboarding-status ─────────────────────────────────
// Backfills exitStatus onto every matching Onboarding record from the
// current state of the Exit collection. Safe to run anytime — it's just a
// bulk re-run of the same sync that happens automatically on every
// exit create/update.
// ─── POST /api/exit/reset-onboarding-status ────────────────────────────────
// Clears exitStatus on EVERY Onboarding record back to empty. Use this once
// before re-running /sync-onboarding-status if a previous sync (e.g. the
// old name-matching fallback) set it incorrectly on the wrong people.
router.post("/reset-onboarding-status", async (req, res) => {
  try {
    const result = await Onboarding.updateMany({}, { $set: { exitStatus: "" } });
    res.json({ success: true, message: `Cleared exitStatus on ${result.modifiedCount} onboarding record(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/sync-onboarding-status", async (req, res) => {
  try {
    const exits = await Exit.find({}, "name officialEmail persEmail exitStatus leftDate plannedExitDate resignationDate").lean();
    let synced = 0;
    for (const e of exits) {
      await syncExitStatusToOnboarding(e);
      synced++;
    }
    res.json({ success: true, message: `Synced exit status for ${synced} exit record(s) onto Onboarding` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Exit.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;