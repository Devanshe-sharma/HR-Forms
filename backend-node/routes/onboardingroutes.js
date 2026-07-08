const express = require("express");
const Onboarding = require('../models/onboardingModel');
const { signEmail, verifySignature } = require('../utils/accessLinkSigning');
// Used only by the HR analytics routes, to resolve real historical exit
// dates for headcount-by-quarter reconstruction (Onboarding only stores
// the current status, not the date it happened).
const Exit = require('../models/exitModel');
const { triggerNewOnboarding, triggerUpdateOnboarding } = require("../emails");
const Employee = require('../models/Employee');

const router = express.Router();

// ─── One-time email fields (flag + timestamp pairs) ─────────────────────────
// These emails only ever get sent once. The *SentAt field is the source of
// truth for "done" — once it's set, it must never be cleared or re-dated by
// a later update, no matter what the submitted form sends for the checkbox.
const EMAIL_FIELDS = [
  ["autoWelcomeEmail", "autoWelcomeEmailSentAt"],
  ["autoReminderEmail", "autoReminderEmailSentAt"],
  ["autoInstructionsToAllEmail", "autoInstructionsToAllEmailSentAt"],
  ["employeeConfirmationEmail", "employeeConfirmationEmailSentAt"],
];

// ─── Emails that double as checklist tasks ─────────────────────────────────
// Sending one of these auto-emails IS the checklist task — no separate
// manual tick should be required. Whenever an email flag is (or becomes)
// true, its matching checklist item gets marked done automatically, using
// the email's own sent timestamp as the doneDate.
const EMAIL_TO_CHECKLIST_ITEM = [
  { flagField: "autoWelcomeEmail", sentAtField: "autoWelcomeEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Welcome Email Done?" },
  { flagField: "autoReminderEmail", sentAtField: "autoReminderEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Reminder Email Done?" },
  { flagField: "autoInstructionsToAllEmail", sentAtField: "autoInstructionsToAllEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Reminder Email ToAll Done?" },
  { flagField: "employeeConfirmationEmail", sentAtField: "employeeConfirmationEmailSentAt", listName: "POST-JOINING TASKS", itemName: "Employee Confirms All OK Done?" },
];

function syncEmailChecklistItems(checkLists, emailFields) {
  for (const { flagField, sentAtField, listName, itemName } of EMAIL_TO_CHECKLIST_ITEM) {
    if (!emailFields[flagField]) continue; // this email was never sent — nothing to sync
    const list = checkLists.find((l) => l.name === listName);
    if (!list) continue;
    const item = list.itemsList.find((it) => it.name === itemName);
    if (!item || item.doneDate) continue; // already marked done — don't touch it
    item.checked = true;
    item.doneDate = emailFields[sentAtField] ? new Date(emailFields[sentAtField]) : new Date();
  }
}

// existing: plain object / doc of current DB values (or null for a brand-new record)
// body: the incoming request body
function resolveOneTimeEmails(existing, body) {
  const resolved = {};
  for (const [flagField, sentAtField] of EMAIL_FIELDS) {
    const alreadySent = !!(existing && existing[sentAtField]);
    if (alreadySent) {
      // Locked in — ignore whatever the form submitted for this field.
      resolved[flagField] = true;
      resolved[sentAtField] = existing[sentAtField];
    } else if (body[flagField]) {
      // Being sent for the first time right now.
      resolved[flagField] = true;
      resolved[sentAtField] = new Date();
    } else {
      resolved[flagField] = false;
      resolved[sentAtField] = null;
    }
  }
  return resolved;
}

// ─── Scoring helper (mirrors Apps Script `scoring` function) ────────────────
function scoreChecklist(list, today) {
  let doneInTime = 0,
    doneButDelayed = 0,
    tasksOverdue = 0,
    tasksDue = 0,
    notYetDue = 0,
    fmsScore = 0,
    tasksNotDone = 0;

  for (const item of list.itemsList) {
    const planDate = item.planDate instanceof Date ? item.planDate : null;
    const doneDate = item.doneDate instanceof Date ? item.doneDate : null;

    if (planDate && !isNaN(planDate.getTime())) {
      const daysDiff = Math.round(
        (planDate.getTime() - today.getTime()) / 86_400_000
      );

      if (doneDate && !isNaN(doneDate.getTime())) {
        const score = Math.round(
          (planDate.getTime() - doneDate.getTime()) / 86_400_000
        );
        item.score = score;
        item.daysLeft = null;

        if (score < 0) {
          item.status = "DONE (DELAYED)";
          doneButDelayed++;
          fmsScore += score;
        } else {
          item.status = "DONE";
          doneInTime++;
        }
      } else {
        if (daysDiff < 0) {
          item.score = daysDiff;
          item.status = "OVERDUE";
          item.daysLeft = daysDiff;
          tasksOverdue++;
          fmsScore += daysDiff;
          tasksNotDone++;
        } else {
          item.score = 0;
          item.status = "PENDING";
          item.daysLeft = daysDiff;
          tasksDue++;
          tasksNotDone++;
        }
      }
    } else {
      if (doneDate) {
        item.score = 0;
        item.status = "DONE";
        item.daysLeft = null;
        doneInTime++;
      } else {
        item.score = 0;
        item.status = "NOT YET DUE";
        item.daysLeft = null;
        notYetDue++;
        tasksNotDone++;
      }
    }
  }

  return {
    doneInTime,
    doneButDelayed,
    tasksOverdue,
    tasksDue,
    notYetDue,
    fmsScore,
    tasksNotDone,
  };
}

// ─── Build the 4 default checklist groups ──────────────────────────────────
function buildDefaultCheckLists() {
  return [
    {
      name: "PRE-JOINING TASKS",
      itemsList: [
        { name: "Welcome Email Done?" },        // ✅ was doneHeader
        { name: "Reminder Email Done?" },
        { name: "Blood Gp Reminder Done?" },
        { name: "Photos Reminder Done?" },
        { name: "Photo Formal Dress Done?" },
        { name: "Reminder Email ToAll Done?" },
        { name: "Verification Of Document Done?" },
      ],
    },
    {
      name: "JOINING-DAY TASKS",
      itemsList: [
        { name: "New BO Email Done?" },
        { name: "Odoo Profile Photo Done?" },
        { name: "Odoo Blood Gp Entry Done?" },
        { name: "Odoo Profile 100% Done?" },
        { name: "Odoo Salary/Contract Done?" },
        { name: "EFP Forms 2/11 Done?" },
        { name: "Employees List Done?" },
        { name: "Seating Done?" },
        { name: "System Issued if Applicable Done?" },
        { name: "BO Presentation Done?" },
        { name: "Employees Hullo Done?" },
        { name: "Employee PAN Card Done?" },
      ],
    },
    {
      name: "POST-JOINING TASKS",
      itemsList: [
        { name: "T-Shirt Issue Done?" },
        { name: "Welcome Kit Issue Done?" },
        { name: "Odoo Eqpt Entry Done?" },
        { name: "Contract/Appt Issue Done?" },
        { name: "Employee File Done?" },
        { name: "Biometric Done?" },
        { name: "Dept Onboarding Done?" },
        { name: "Role Briefing Done?" },
        { name: "Amend LinkedIn Profile Done?" },
        { name: "Add Email for Google Contacts Sharing if Applicable Done?" },
        { name: "Taken Over from Exiting Employee, If Applicable Done?" },
        { name: "DME: Checklists/ Delegation Passwords Done?" },
        { name: "Dept: Allocate Checklist/ Delegation Done?" },
        { name: "Allocate Buddy Done?" },
        { name: "Employee Confirms All OK Done?" },
        { name: "Onboarding Test Done?" },
        { name: "Emailed All Clients New Member Has Joined if Applicable Done?" },
        { name: "Coffee With Directors Done?" },
        { name: "Check if UAN Applicable Done?" },
        { name: "UAN (PF) if applicable completed Done?" },
        { name: "KYC (PF) if applicable completed Done?" },
        { name: "Add Employee to BO WhatsApp Gp Done?" },
      ],
    },
    {
      name: "FINAL-JOINING TASKS",
      itemsList: [
        { name: "Medical Insurance Card Issued if Applicable Done?" },
        { name: "First Salary Transfer Done?" },
      ],
    },
  ];
}
// ─── Assign plan dates (mirrors Apps Script logic) ─────────────────────────
function assignPlanDates(checkLists, joiningStatus, offerAcceptedDate, joinedDate) {
  for (const list of checkLists) {
    let planDate;

    if (list.name === "PRE-JOINING TASKS") {
      const base = joiningStatus === "Joined" ? joinedDate : offerAcceptedDate;
      if (base) {
        planDate = new Date(base);
        planDate.setDate(planDate.getDate() + 5);
      }
    } else if (
      ["JOINING-DAY TASKS", "POST-JOINING TASKS", "FINAL-JOINING TASKS"].includes(
        list.name
      ) &&
      joinedDate
    ) {
      planDate = new Date(joinedDate);
      planDate.setDate(planDate.getDate() + 15);
    }

    if (planDate) {
      list.planDate = planDate;
      for (const item of list.itemsList) {
        item.planDate = planDate;
      }
    }
  }
}

// ─── Safely turn a Mongoose checklist array into clean plain objects ───────
// Never spread Mongoose (sub)documents directly — depending on version this
// can silently drop fields or leak internal Mongoose properties into the
// object that later gets written back with findByIdAndUpdate. Always route
// through toObject() and pick the exact fields we care about.
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

// ─── POST /api/onboarding  — Create new onboarding ────────────────────────
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // 1. Build checklist structure
    const checkLists = buildDefaultCheckLists();

    // 2. Map submitted done-states (array of booleans per list) onto itemsList
    //    Frontend sends: checkLists: [ { itemsList: [true, false, ...] }, ... ]
    if (Array.isArray(body.checkLists)) {
  body.checkLists.forEach((submittedList, listIdx) => {
    const submittedItems =
      submittedList.items ||
      submittedList.itemsList ||
      [];

    submittedItems.forEach((item, itemIdx) => {
      const target = checkLists[listIdx]?.itemsList?.[itemIdx];

      if (!target) return;

      // frontend may send boolean OR object
      const isChecked =
        typeof item === "boolean"
          ? item
          : item?.checked;

      if (isChecked) {
        target.checked = true;
        target.doneDate = new Date();
      }
    });
  });
}

    // 3. Resolve one-time email flags, then sync their matching checklist
    //    items — this must happen BEFORE plan dates/scoring below so the
    //    computed totals (doneInTime, tasksDue, etc.) reflect them.
    const emailFields = resolveOneTimeEmails(null, body);
    syncEmailChecklistItems(checkLists, emailFields);

    // 4. Assign plan dates
    assignPlanDates(
      checkLists,
      body.joiningStatus ?? "",
      body.offerAcceptedDate ? new Date(body.offerAcceptedDate) : undefined,
      body.joinedDate ? new Date(body.joinedDate) : undefined
    );

    // 5. Score every list
    const today = new Date();
    let doneInTime = 0,
      doneButDelayed = 0,
      tasksOverdue = 0,
      tasksDue = 0,
      notYetDue = 0,
      fmsScore = 0,
      tasksNotDone = 0;

    const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);

    for (const list of checkLists) {
      const r = scoreChecklist(list, today);
      doneInTime += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue += r.tasksOverdue;
      tasksDue += r.tasksDue;
      notYetDue += r.notYetDue;
      fmsScore += r.fmsScore;
      tasksNotDone += r.tasksNotDone;
    }

    const fmsStatus = tasksNotDone === 0 ? "Closed" : "Open";

    // 6. If "Not Joining" override to Closed
    const finalStatus =
      body.joiningStatus === "Not Joining" ? "Closed" : fmsStatus;

    // 7. Build and save document
    const doc = new Onboarding({
      ...body,
      ...emailFields,
      offerAcceptedDate: body.offerAcceptedDate
        ? new Date(body.offerAcceptedDate)
        : undefined,
      plannedJoiningDate: body.plannedJoiningDate
        ? new Date(body.plannedJoiningDate)
        : undefined,
      joinedDate: body.joinedDate ? new Date(body.joinedDate) : undefined,
      salApplicableFrom: body.salApplicableFrom
        ? new Date(body.salApplicableFrom)
        : undefined,
      confirmationDueDate: body.confirmationDueDate
        ? new Date(body.confirmationDueDate)
        : undefined,
      salRevisionDueDate: body.salRevisionDueDate
        ? new Date(body.salRevisionDueDate)
        : undefined,
      checkLists,
      totalTasks,
      doneInTime,
      doneButDelayed,
      tasksOverdue,
      tasksDue,
      notYetDue,
      fmsScore,
      fmsStatus: finalStatus,
    });

  await doc.save();
    triggerNewOnboarding(doc).catch(console.error); // fire-and-forget
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Anyone with an exit record has left the company — they shouldn't show up
// Statuses that mean the person has actually left — "Serving Notice Period"
// still counts as employed, and "Not Exiting"/"Exit Cancelled" mean they
// never left at all, so neither should exclude someone from the master list.
const EXITED_STATUS_VALUES = new Set(["Left", "Already Left"]);

// ─── GET /api/onboarding/eligible-employees  — Salary Revision employee source ──
// Salary Revision used to pull its employee picker from a separate Employee
// collection. Onboarding is now the single source of truth for who's
// actually joined, so this shapes Onboarding records into the same fields
// Salary Revision's UI already expects. Uses the onboarding record's own
// _id as "employee_id" so revisions can be linked straight back to it.
// Onboarding's own exitStatus field (kept in sync by the Exit module
// whenever an exit is created/updated) is checked directly here — no live
// join to the Exit collection needed.
// ─── POST /api/onboarding/reconcile-checklist-template ─────────────────────
// Backfills any checklist task that's been added to buildDefaultCheckLists()
// since a record was created — e.g. adding "Add Employee to BO WhatsApp Gp
// Done?" to POST-JOINING TASKS. Existing items are matched by name and left
// completely untouched; only genuinely missing tasks get added. Safe to
// re-run anytime, including after future task additions.
// ─── POST /api/onboarding/sync-dept-and-exitstatus-from-sheet ──────────────
// Updates ONLY the dept and exitStatus fields on existing Onboarding
// records, from a corrected master sheet export — deliberately narrow so
// it doesn't touch anything else (salary, checklists, dates, etc.) that
// already lives correctly in MongoDB.
// Body: { csv: "<raw CSV file contents as a string>" }
// Matching: Official Email → Personal Email → exact Name, in that order.
// Exit Status: only applied when the sheet's value is non-blank ("Left") —
// a blank cell means "not tracked here," not "definitely not exited," so
// it must never silently clear an exitStatus already set via the Exit
// module's own sync.
router.post(
  "/sync-dept-and-exitstatus-from-sheet",
  express.text({ type: "*/*", limit: "10mb" }),
  async (req, res) => {
  try {
    // Accepts EITHER a raw CSV text body (Content-Type: text/plain — the
    // recommended way, since PowerShell's ConvertTo-Json can silently
    // corrupt very large strings when JSON-wrapping them) OR the older
    // { csv: "<file contents>" } JSON form, for backward compatibility.
    let csvText;
    if (typeof req.body === "string" && req.body.trim()) {
      csvText = req.body;
    } else if (req.body && typeof req.body.csv === "string") {
      csvText = req.body.csv;
    }

    if (!csvText) {
      return res.status(400).json({
        success: false,
        message: "Provide the raw CSV as the request body (Content-Type: text/plain), or { csv: \"<file contents>\" } as JSON",
      });
    }

    const { parse: parseCsv } = require("csv-parse/sync");
    const records = parseCsv(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: false,
      relax_quotes: true, // tolerate stray quote characters (e.g. from corrupted special characters)
    });

    const all = await Onboarding.find({}, "name officialEmail persEmail dept exitStatus joinedDate").lean();

    // Parses the sheet's date formats (DD/MM/YYYY, DD MMM YY, MMM D, YYYY)
    // — same approach used for the standalone Exit CSV import.
    const MONTH_MAP = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    function parseSheetDate(raw) {
      if (!raw) return null;
      const s = String(raw).trim();
      if (!s || s.toUpperCase() === "NA") return null;
      let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) { const d = new Date(Date.UTC(+m[3], +m[2]-1, +m[1])); if (!isNaN(d)) return d; }
      m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2,4})$/);
      if (m) { const mon = MONTH_MAP[m[2].toLowerCase()]; let y=+m[3]; if(y<100)y+=2000; if(mon!==undefined){const d=new Date(Date.UTC(y,mon,+m[1])); if(!isNaN(d))return d;} }
      m = s.match(/^([A-Za-z]{3})\w*\s+(\d{1,2}),\s*(\d{4})$/);
      if (m) { const mon = MONTH_MAP[m[1].toLowerCase()]; if(mon!==undefined){const d=new Date(Date.UTC(+m[3],mon,+m[2])); if(!isNaN(d))return d;} }
      const fb = new Date(s);
      return isNaN(fb) ? null : fb;
    }

    let updated = 0;
    const unmatched = [];
    const skippedRehires = [];

    for (const row of records) {
      const name = (row["Name"] || "").trim();
      if (!name) continue;

      const officialEmail = (row["Official Email"] || "").trim().toLowerCase();
      const persEmail = (row["Personal Email"] || "").trim().toLowerCase();
      const sheetDept = (row["Dept"] || "").trim();
      const sheetExitStatus = (row["Exit Status"] || "").trim();

      // Personal email FIRST — official addresses (like hr.head@company.com)
      // are often role-based and get reused across different successive
      // people, which would otherwise misattribute one person's exit onto
      // whoever currently holds that same official email.
      let match = null;
      if (persEmail) {
        match = all.find((o) => (o.persEmail || "").trim().toLowerCase() === persEmail);
      }
      if (!match && officialEmail) {
        match = all.find((o) => (o.officialEmail || "").trim().toLowerCase() === officialEmail);
      }
      if (!match) {
        match = all.find((o) => (o.name || "").trim().toLowerCase() === name.toLowerCase());
      }

      if (!match) {
        unmatched.push(name);
        continue;
      }

      const setFields = {};
      if (sheetDept) setFields.dept = sheetDept;

      if (sheetExitStatus) {
        // Rehire-aware: if this person's own joinedDate is AFTER the
        // sheet's exit reference date, this "Left" entry predates their
        // current stint (e.g. shared official email with a predecessor,
        // or a genuine earlier exit before they were rehired) — don't
        // mark them exited while they're actually currently employed.
        const exitRefDate = parseSheetDate(row["Left Date"]) || parseSheetDate(row["Planned Exit Date"]) || parseSheetDate(row["Resignation Email Sent on"]);
        const joinedDate = match.joinedDate ? new Date(match.joinedDate) : null;

        if (joinedDate && exitRefDate && joinedDate > exitRefDate) {
          skippedRehires.push(name);
        } else {
          setFields.exitStatus = sheetExitStatus;
          // No point tracking onboarding tasks for someone who's actually
          // gone — "Serving Notice Period" stays open (still employed).
          if (["Left", "Already Left"].includes(sheetExitStatus)) {
            setFields.fmsStatus = "Closed";
          }
        }
      }

      if (Object.keys(setFields).length > 0) {
        await Onboarding.findByIdAndUpdate(match._id, setFields);
        updated++;
      }
    }

    res.json({
      success: true,
      message: `Updated ${updated} record(s). ${unmatched.length} row(s) had no matching Onboarding record. ${skippedRehires.length} exit status(es) skipped as likely rehires.`,
      unmatched,
      skippedRehires,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/onboarding/close-fms-for-exited ─────────────────────────────
// One-time backfill: closes fmsStatus on every onboarding record whose
// exitStatus is already "Left" or "Already Left" but whose fmsStatus is
// still "Open" — for anyone who got marked exited before this
// auto-close behavior existed. Safe to re-run anytime.
router.post("/close-fms-for-exited", async (req, res) => {
  try {
    const result = await Onboarding.updateMany(
      { exitStatus: { $in: ["Left", "Already Left"] }, fmsStatus: { $ne: "Closed" } },
      { $set: { fmsStatus: "Closed" } }
    );
    res.json({ success: true, message: `Closed FMS on ${result.modifiedCount} already-exited record(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/reconcile-checklist-template", async (req, res) => {
  try {
    const docs = await Onboarding.find();
    let updated = 0;

    for (const existing of docs) {
      const existingPlain = existing.toObject();
      const checkLists = reconcileChecklistsWithTemplate(existingPlain.checkLists);

      const today = new Date();
      let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
          tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

      for (const list of checkLists) {
        const r = scoreChecklist(list, today);
        doneInTime += r.doneInTime;
        doneButDelayed += r.doneButDelayed;
        tasksOverdue += r.tasksOverdue;
        tasksDue += r.tasksDue;
        notYetDue += r.notYetDue;
        fmsScore += r.fmsScore;
        tasksNotDone += r.tasksNotDone;
      }

      const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
      const fmsStatus = existing.joiningStatus === "Not Joining" || tasksNotDone === 0
        ? "Closed" : "Open";

      await Onboarding.findByIdAndUpdate(existing._id, {
        checkLists, totalTasks, doneInTime, doneButDelayed,
        tasksOverdue, tasksDue, notYetDue, fmsScore, fmsStatus,
      });
      updated++;
    }

    res.json({ success: true, message: `Reconciled checklist template on ${updated} onboarding record(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/onboarding/employee-master ───────────────────────────────────
// The real employee master — built entirely from Onboarding, replacing the
// old Dept & Designation Master sheet (which was placeholder data, never
// kept in sync with reality). Includes EVERY employee ever onboarded —
// current AND exited — each flagged with is_current/is_exited, plus
// department and designation lists derived from what's actually in use
// across real records, instead of a separate stale sheet.
// ─── GET /api/onboarding/employee-master ───────────────────────────────────
// The real employee master — WHO exists, built entirely from Onboarding.
// Includes EVERY employee ever onboarded — current AND exited — each
// flagged with is_current/is_exited. Deliberately does NOT include
// department/designation option lists: those are owned by the actual Dept
// & Designation Master, since a new department can legitimately exist with
// zero employees in it yet (e.g. before the first hire) — deriving that
// list from Onboarding would make it impossible to add one in advance.
// ============================================================
// HR ANALYTICS: Teeth-to-Tail Ratio
// ============================================================
// "Teeth" = Delivery departments, "Tail" = Support departments — read
// directly from RoleMaster's own department_type field (the real Dept &
// Designation Master, set via the "Type" dropdown on that page), NOT
// guessed from department name patterns. Any department without a Type
// set yet (or a name that doesn't match anything in RoleMaster at all)
// falls into "Uncategorized" so it stays visible rather than being
// silently miscounted either way.
//
// NOTE: assumes the RoleMaster model is at '../models/RoleMaster' — if
// your actual file has a different name/casing, adjust this require to
// match (same class of issue we hit with onboarding/exit model filenames).
const RoleMaster = require("../models/role_master");

// RoleMaster stores one row PER designation under each department, so the
// same department name can appear many times with potentially different
// department_type values across rows (e.g. if only some designations were
// updated). This picks whichever row ACTUALLY has a Type set for that
// department — a blank Type on one designation row must never override a
// real one set on another row for the same department.
// RoleMaster has a mix of legacy raw-imported documents (using PascalCase
// keys like "Department" / "Department Type (Delivery or Support)" — and
// even a typo'd "Department Type (Deliveryor Support)" on at least one
// document) and properly schema-shaped documents (lowercase "department" /
// "department_type"). Mongoose's schema-aware .find() silently returns
// blank for every legacy document, since their real Type value lives under
// a different literal key than the schema expects — that's why so many
// departments showed Uncategorized despite clearly having a Type visible
// in the raw data. Reading via the raw collection driver and checking
// every known key variant fixes this regardless of which shape a given
// document happens to be in.
async function getDepartmentTypeMap() {
  const rows = await RoleMaster.collection.find({}).toArray();
  const map = new Map();
  for (const r of rows) {
    const deptRaw = r.department ?? r.Department ?? "";
    const dept = String(deptRaw || "").trim().toLowerCase();
    if (!dept) continue;

    const typeRaw =
      r.department_type ??
      r["Department Type (Delivery or Support)"] ??
      r["Department Type (Deliveryor Support)"] ??
      "";
    const type = String(typeRaw || "").trim();

    if (type) {
      map.set(dept, type); // a real Type always wins, whenever it's found
    } else if (!map.has(dept)) {
      map.set(dept, ""); // reserve the key so the department is still known
    }
  }
  return map;
}

// Onboarding sometimes uses abbreviations or slightly different spellings
// than the canonical department name in RoleMaster. This maps the known
// ones onto RoleMaster's real name so they resolve to the same Type
// instead of silently falling into Uncategorized. Add to this as new
// mismatches turn up.
const DEPARTMENT_ALIASES = {
  "tcs": "temporary staffing",
  "daa": "data analytics and automation",
  "admin": "administration",
  "recruitment": "recruitment services",
  "hr": "human resources",
  "design & develpoment": "engineering",
  "support": "administration",
  // "iab": "internal audit board", — NOT added yet: "Internal Audit
  // Board" doesn't exist as a department in RoleMaster at all, so this
  // alias would still resolve to nothing. Either add that department to
  // the Dept & Designation Master with a Type set, or tell us which
  // existing department it should actually map to instead.
};

// Resolves an Onboarding dept string to whichever RoleMaster department
// name it should be treated as, before looking up its Type. Handles:
//   - exact match (already canonical)
//   - known aliases/abbreviations (see DEPARTMENT_ALIASES)
//   - compound "A/B" values — tries each half against both the alias map
//     and RoleMaster directly, since these look like dual-department
//     entries rather than a single real department name
function resolveDeptKey(dept, deptTypeMap) {
  const d = (dept || "").trim().toLowerCase();
  if (!d) return null;
  if (deptTypeMap.has(d)) return d;
  if (DEPARTMENT_ALIASES[d] && deptTypeMap.has(DEPARTMENT_ALIASES[d])) return DEPARTMENT_ALIASES[d];

  if (d.includes("/")) {
    for (const part of d.split("/").map((p) => p.trim())) {
      if (deptTypeMap.has(part)) return part;
      if (DEPARTMENT_ALIASES[part] && deptTypeMap.has(DEPARTMENT_ALIASES[part])) return DEPARTMENT_ALIASES[part];
    }
  }

  return null;
}

function categorizeDept(dept, deptTypeMap) {
  const key = resolveDeptKey(dept, deptTypeMap);
  if (!key) return "Uncategorized";
  const type = deptTypeMap.get(key);
  if (type === "Delivery") return "Teeth";
  if (type === "Support") return "Tail";
  return "Uncategorized";
}

// Last instant of the given quarter (1-4) in the given year, in UTC.
function quarterEndDate(year, quarter) {
  const endMonth = quarter * 3; // 3, 6, 9, 12
  return new Date(Date.UTC(year, endMonth, 0, 23, 59, 59));
}

// ─── GET /api/onboarding/analytics/teeth-to-tail?year=YYYY ────────────────
router.get("/analytics/teeth-to-tail", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const deptTypeMap = await getDepartmentTypeMap();

    const docs = await Onboarding.find(
      {},
      "name dept officialEmail persEmail joinedDate exitStatus"
    ).lean();

    const exits = await Exit.find(
      {},
      "persEmail officialEmail leftDate plannedExitDate resignationDate"
    ).lean();

    const exitDateOfRecord = (e) => {
      const d = e.leftDate || e.plannedExitDate || e.resignationDate;
      const t = d ? new Date(d).getTime() : NaN;
      return isNaN(t) ? -Infinity : t;
    };

    // Resolve each exited employee's real exit date by matching against the
    // Exit collection (persEmail first, officialEmail fallback), taking
    // whichever of their exit records is chronologically latest — same
    // approach used for the live exitStatus sync, so a re-exit after a
    // rehire is still handled correctly here.
    function resolveExitDate(emp) {
      const persEmail = (emp.persEmail || "").trim().toLowerCase();
      const officialEmail = (emp.officialEmail || "").trim().toLowerCase();

      let candidates = [];
      if (persEmail) {
        candidates = exits.filter((e) => (e.persEmail || "").trim().toLowerCase() === persEmail);
      }
      if (candidates.length === 0 && officialEmail) {
        candidates = exits.filter((e) => (e.officialEmail || "").trim().toLowerCase() === officialEmail);
      }
      if (candidates.length === 0) return null;

      const latest = candidates.reduce(
        (l, e) => (!l || exitDateOfRecord(e) > exitDateOfRecord(l) ? e : l),
        null
      );
      const d = latest.leftDate || latest.plannedExitDate || latest.resignationDate;
      return d ? new Date(d) : null;
    }

    const EXITED = new Set(["Left", "Already Left"]);
    const employees = docs.map((d) => ({
      ...d,
      isMarkedExited: EXITED.has(d.exitStatus),
      resolvedExitDate: EXITED.has(d.exitStatus) ? resolveExitDate(d) : null,
    }));

    const quarters = [1, 2, 3, 4].map((q) => {
      const asOf = quarterEndDate(year, q);
      let teeth = 0, tail = 0, uncategorized = 0;

      for (const emp of employees) {
        if (!emp.joinedDate) continue;
        const joined = new Date(emp.joinedDate);
        if (joined > asOf) continue; // hadn't joined by this quarter-end yet

        if (emp.isMarkedExited) {
          if (emp.resolvedExitDate) {
            // We know exactly when — only exclude from quarters at/after that date.
            if (emp.resolvedExitDate <= asOf) continue;
          } else {
            // Marked exited (e.g. via the master sheet) but with no formal
            // Exit record to pin down a date. Safer to treat them as
            // excluded from every quarter than to risk silently counting
            // someone who's actually gone as still active.
            continue;
          }
        }

        const cat = categorizeDept(emp.dept, deptTypeMap);
        if (cat === "Teeth") teeth++;
        else if (cat === "Tail") tail++;
        else uncategorized++;
      }

      const ratio = tail > 0 ? Math.round((teeth / tail) * 100) / 100 : null;

      return {
        quarter: `Q${q}`,
        asOf: asOf.toISOString(),
        teeth,
        tail,
        uncategorized,
        total: teeth + tail + uncategorized,
        ratio,
      };
    });

    // Department-level breakdown (current employees, independent of the
    // selected year/quarter) — shows exactly which departments are driving
    // the Uncategorized count, so it's obvious what needs a Type set in
    // the Dept & Designation Master rather than just seeing a mystery
    // number.
    const currentEmployees = docs.filter((d) => !EXITED.has(d.exitStatus || ""));
    const deptCounts = {};
    for (const d of currentEmployees) {
      const dept = (d.dept || "").trim() || "(Blank)";
      if (!deptCounts[dept]) {
        deptCounts[dept] = { department: dept, category: categorizeDept(d.dept, deptTypeMap), count: 0 };
      }
      deptCounts[dept].count++;
    }
    const departmentBreakdown = Object.values(deptCounts).sort((a, b) => b.count - a.count);

    // Only offer years that actually have joining data, plus the current year.
    const joinYears = docs
      .map((d) => (d.joinedDate ? new Date(d.joinedDate).getFullYear() : null))
      .filter(Boolean);
    const minYear = joinYears.length ? Math.min(...joinYears) : year;
    const maxYear = Math.max(new Date().getFullYear(), ...(joinYears.length ? joinYears : [year]));
    const availableYears = [];
    for (let y = maxYear; y >= minYear; y--) availableYears.push(y);

    res.json({ success: true, year, quarters, availableYears, departmentBreakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/onboarding/analytics/gender ──────────────────────────────────
// Gender split among CURRENT employees only (joined and not exited) —
// overall counts, plus a per-department breakdown so it's clear whether
// any imbalance is company-wide or concentrated in specific departments.
router.get("/analytics/gender", async (req, res) => {
  try {
    const docs = await Onboarding.find({}, "gender dept joiningStatus exitStatus").lean();
    // Matches the Onboarding Dashboard's own "Current Employees" definition
    // exactly: not exited, regardless of joiningStatus. Someone marked
    // "Yet To Join Office" still counts as current there, so this must
    // count them too, or the two numbers won't match.
    const EXITED = new Set(["Left", "Already Left"]);
    const current = docs.filter((d) => !EXITED.has(d.exitStatus || ""));

    const genderCounts = {};
    const byDept = {};

    for (const d of current) {
      const g = (d.gender || "").trim() || "Not Specified";
      genderCounts[g] = (genderCounts[g] || 0) + 1;

      const dept = (d.dept || "").trim() || "Unassigned";
      if (!byDept[dept]) byDept[dept] = {};
      byDept[dept][g] = (byDept[dept][g] || 0) + 1;
    }

    const genders = Object.keys(genderCounts).sort();
    const overall = genders.map((g) => ({ gender: g, count: genderCounts[g] }));

    const departments = Object.keys(byDept).sort();
    const byDepartment = departments.map((dept) => {
      const row = { department: dept };
      genders.forEach((g) => { row[g] = byDept[dept][g] || 0; });
      return row;
    });

    res.json({ success: true, total: current.length, genders, overall, byDepartment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/onboarding/verify-access ──────────────────────────────────────
// ACL gate: checks whether the given official email belongs to a CURRENT
// (not exited) employee in Onboarding — the single source of truth. Used
// by the frontend's ProtectedRoute to decide whether someone reaching the
// portal via the ?name=&email= link should actually get in.
router.get("/verify-access", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    const sig = req.query.sig || "";

    if (!email) {
      return res.json({ success: true, allowed: false, reason: "missing_email" });
    }

    // The signature proves this exact email came from a link we actually
    // generated — without it, anyone could edit ?email= in the URL to any
    // other real employee's address and get treated as that person. This
    // check has nothing to do with whether the email belongs to a real
    // employee (that's checked separately below) — it's specifically
    // about whether THIS request is allowed to claim to BE that email.
    if (!verifySignature(email, sig)) {
      return res.json({ success: true, allowed: false, reason: "invalid_signature" });
    }

    const docs = await Onboarding.find({}, "name officialEmail exitStatus dept designation").lean();
    const match = docs.find((d) => (d.officialEmail || "").trim().toLowerCase() === email);

    if (!match) {
      return res.json({ success: true, allowed: false, reason: "not_found" });
    }

    if (EXITED_STATUS_VALUES.has(match.exitStatus || "")) {
      return res.json({ success: true, allowed: false, reason: "exited" });
    }

    return res.json({
      success: true,
      allowed: true,
      employee: {
        name: match.name || "",
        officialEmail: match.officialEmail || "",
        dept: match.dept || "",
        designation: match.designation || "",
      },
    });
  } catch (err) {
    console.error("[verify-access] error:", err.message);
    res.status(500).json({ success: false, allowed: false, message: err.message });
  }
});

// ─── GET /api/onboarding/generate-access-link ──────────────────────────────
// Produces a signed link for a specific current employee. Intended to be
// called by trusted internal systems only (e.g. whatever currently sends
// onboarding welcome emails) — never expose this to the public internet
// without its own auth, since anyone who can call it can mint a valid
// link for any employee.
router.get("/generate-access-link", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: "email is required" });

    const doc = await Onboarding.findOne(
      { officialEmail: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      "name officialEmail exitStatus"
    ).lean();

    if (!doc) return res.status(404).json({ success: false, message: "No matching employee found" });
    if (EXITED_STATUS_VALUES.has(doc.exitStatus || "")) {
      return res.status(400).json({ success: false, message: "This employee has exited" });
    }

    const sig = signEmail(doc.officialEmail);
    const base = process.env.FRONTEND_URL || "https://hr.briskolive.com";
    const link = `${base}/company-orientation?name=${encodeURIComponent(doc.name || "")}&email=${encodeURIComponent(doc.officialEmail)}&sig=${sig}`;

    res.json({ success: true, link });
  } catch (err) {
    console.error("[generate-access-link] error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/employee-master", async (req, res) => {
  try {
    const docs = await Onboarding.find(
      {},
      "name dept designation officialEmail persEmail joiningStatus exitStatus joinedDate reportingHead employeeCategory"
    ).lean();

    const employees = docs.map((d) => {
      const isExited = EXITED_STATUS_VALUES.has(d.exitStatus || "");
      const isCurrent = d.joiningStatus === "Joined" && !isExited;
      return {
        _id: String(d._id),
        employee_id: String(d._id),
        full_name: d.name || "",
        department: d.dept || "",
        designation: d.designation || "",
        official_email: d.officialEmail || "",
        email: d.officialEmail || d.persEmail || "",
        joining_date: d.joinedDate || null,
        employee_category: d.employeeCategory || "",
        reporting_head: d.reportingHead || "",
        exit_status: d.exitStatus || "",
        is_current: isCurrent,
        is_exited: isExited,
      };
    });

    res.json({ success: true, data: { employees } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/eligible-employees", async (req, res) => {
  try {
    const docs = await Onboarding.find({ joiningStatus: "Joined" })
      .select(
        "name dept designation officialEmail persEmail joinedDate employeeCategory exitStatus " +
        "annualCtc basicSal hraSal grossMonthly empEpf gratuity annualBonus " +
        "annualPerformanceIncentive medicalPremium travelAllowance telephoneReimbursement reportingHead"
      )
      .lean();

    const activeDocs = docs.filter((d) => !EXITED_STATUS_VALUES.has(d.exitStatus || ""));

    const employees = activeDocs.map((d) => ({
      _id: String(d._id),
      employee_id: String(d._id),
      full_name: d.name || "",
      department: d.dept || "",
      designation: d.designation || "",
      email: d.officialEmail || d.persEmail || "",
      official_email: d.officialEmail || "",
      joining_date: d.joinedDate || null,
      employee_category: d.employeeCategory || "",
      annual_ctc: d.annualCtc || 0,
      basic: d.basicSal ?? "",
      hra: d.hraSal ?? "",
      gross_monthly: d.grossMonthly ?? "",
      employer_pf: d.empEpf ?? "",
      gratuity: d.gratuity ?? "",
      annual_bonus: d.annualBonus ?? "",
      annual_performance_incentive: d.annualPerformanceIncentive ?? "",
      medical_premium: d.medicalPremium ?? "",
      travel_allowance: d.travelAllowance ?? "",
      telephone_allowance: d.telephoneReimbursement ?? "",
      reporting_head: d.reportingHead || "",
    }));

    res.json({ success: true, data: employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/onboarding  — List all (open first) ─────────────────────────
// Shows every onboarding record, including employees who have since
// exited — this stays a full historical view. The exit-exclusion only
// applies to the employee master list below.
router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const docs = await Onboarding.find()
      .sort({ fmsStatus: 1, createdAt: -1 });

    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/onboarding/:id  — Single record with full checklists ─────────
router.get("/:id", async (req, res) => {
  try {
    const doc = await Onboarding.findById(req.params.id);
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ONE-TIME MIGRATION: backfill task names ──────────────────────────────
router.post("/migrate/fix-names", async (req, res) => {
  try {
    const template = buildDefaultCheckLists();
    const docs = await Onboarding.find();
    let updated = 0;

    for (const doc of docs) {
      let changed = false;
      doc.checkLists.forEach((list, li) => {
        const templateList = template[li];
        if (!templateList) return;
        list.itemsList.forEach((item, ii) => {
          const templateItem = templateList.itemsList[ii];
          if (templateItem && !item.name) {
            item.name = templateItem.name;
            changed = true;
          }
        });
      });
      if (changed) {
        await doc.save();
        updated++;
      }
    }

    res.json({ success: true, message: `Updated ${updated} records` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ─── PUT /api/onboarding/:id  — Update onboarding ─────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const body = req.body;
    const existing = await Onboarding.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    // ─── Sync to Employee when joiningStatus flips to "Joined" ───────────────
    const newStatus = body.joiningStatus;
    const wasNotJoined = existing.joiningStatus !== 'Joined';

    if (newStatus === 'Joined' && wasNotJoined) {
      const empExists = await Employee.findOne({
        $or: [
          { official_email: existing.officialEmail },
          { employee_id:    body.emp_id || existing.emp_id || '' },
        ].filter(c => Object.values(c)[0]) // skip empty string matches
      });

      if (!empExists) {
        await Employee.create({
          employee_id:       body.emp_id        || existing.emp_id        || '',
          full_name:         body.name          || existing.name          || '',
          official_email:    existing.officialEmail                       || '',
          personal_email:    existing.persEmail                           || '',
          mobile:            existing.mobile                              || '',
          department:        body.dept          || existing.dept          || '',
          designation:       body.designation   || existing.designation   || '',
          dept_id:           body.dept_id       || existing.dept_id       || null,
          desig_id:          body.desig_id      || existing.desig_id      || null,
          gender:            existing.gender                              || '',
          joining_date:      body.joinedDate    || existing.joinedDate    || '',
          employee_category: existing.employeeCategory                    || '',
          name_of_buddy:     existing.nameOfBuddy                        || '',
          joining_status:    'Joined',
          isArchived:        false,
        });
        console.log(`[Onboarding] ✅ Employee record created for ${existing.name}`);
      } else {
        // Already exists — just update joining status
        await Employee.findByIdAndUpdate(empExists._id, {
          joining_status: 'Joined',
          joining_date:   body.joinedDate || existing.joinedDate || empExists.joining_date,
        });
        console.log(`[Onboarding] ✅ Employee record updated for ${existing.name}`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Re-use existing checklist structure — routed through toObject() and
    // toPlainCheckLists() so we're mutating clean plain objects, never raw
    // Mongoose subdocuments (spreading those directly is what silently broke
    // ticked items not saving).
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

    // One-time emails: never unsend, never re-date, once sent always "Done".
    // Resolved here (before plan dates/scoring) so the sync below can mark
    // matching checklist items done in time for the totals to include them.
    const emailFields = resolveOneTimeEmails(existingPlain, body);
    syncEmailChecklistItems(checkLists, emailFields);

    assignPlanDates(
      checkLists,
      body.joiningStatus        ?? existing.joiningStatus        ?? "",
      body.offerAcceptedDate    ? new Date(body.offerAcceptedDate)    : existing.offerAcceptedDate,
      body.joinedDate           ? new Date(body.joinedDate)           : existing.joinedDate
    );

    const today = new Date();
    let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
        tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

    for (const list of checkLists) {
      const r = scoreChecklist(list, today);
      doneInTime     += r.doneInTime;
      doneButDelayed += r.doneButDelayed;
      tasksOverdue   += r.tasksOverdue;
      tasksDue       += r.tasksDue;
      notYetDue      += r.notYetDue;
      fmsScore       += r.fmsScore;
      tasksNotDone   += r.tasksNotDone;
    }

    const fmsStatus = body.joiningStatus === "Not Joining" || tasksNotDone === 0
      ? "Closed" : "Open";

    const updated = await Onboarding.findByIdAndUpdate(
      req.params.id,
      {
        ...body,
        ...emailFields,
        offerAcceptedDate:   body.offerAcceptedDate   ? new Date(body.offerAcceptedDate)   : existing.offerAcceptedDate,
        plannedJoiningDate:  body.plannedJoiningDate  ? new Date(body.plannedJoiningDate)  : existing.plannedJoiningDate,
        joinedDate:          body.joinedDate          ? new Date(body.joinedDate)           : existing.joinedDate,
        salApplicableFrom:   body.salApplicableFrom   ? new Date(body.salApplicableFrom)   : existing.salApplicableFrom,
        confirmationDueDate: body.confirmationDueDate ? new Date(body.confirmationDueDate) : existing.confirmationDueDate,
        salRevisionDueDate:  body.salRevisionDueDate  ? new Date(body.salRevisionDueDate)  : existing.salRevisionDueDate,
        checkLists,
        doneInTime, doneButDelayed, tasksOverdue,
        tasksDue, notYetDue, fmsScore, fmsStatus,
      },
      { new: true, runValidators: true }
    );

    triggerUpdateOnboarding(updated).catch(console.error);
    res.json({ success: true, data: updated });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Shared recompute logic used by both resync routes below ──────────────
// Rebuilds item-level planDates and every derived score/summary field from
// scratch, using clean plain objects (never a raw Mongoose subdoc spread).
// This repairs records saved before the checklist-merge fix, where item
// planDate could get silently dropped even though the group-level planDate
// saved fine.
async function recomputeOnboarding(existing) {
  const existingPlain = existing.toObject();
  const checkLists = toPlainCheckLists(existingPlain.checkLists);

  // Repair any email/checklist mismatch too — e.g. an email flag that's
  // true but whose matching checklist item was never marked done.
  syncEmailChecklistItems(checkLists, existingPlain);

  assignPlanDates(
    checkLists,
    existing.joiningStatus ?? "",
    existing.offerAcceptedDate,
    existing.joinedDate
  );

  const today = new Date();
  let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
      tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

  for (const list of checkLists) {
    const r = scoreChecklist(list, today);
    doneInTime     += r.doneInTime;
    doneButDelayed += r.doneButDelayed;
    tasksOverdue   += r.tasksOverdue;
    tasksDue       += r.tasksDue;
    notYetDue      += r.notYetDue;
    fmsScore       += r.fmsScore;
    tasksNotDone   += r.tasksNotDone;
  }

  const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
  const fmsStatus = existing.joiningStatus === "Not Joining" || tasksNotDone === 0
    ? "Closed" : "Open";

  return Onboarding.findByIdAndUpdate(
    existing._id,
    { checkLists, totalTasks, doneInTime, doneButDelayed, tasksOverdue, tasksDue, notYetDue, fmsScore, fmsStatus },
    { new: true, runValidators: true }
  );
}

// ─── ONE-TIME FIX: recompute a single record's checklist + summary fields ──
// Call this for any joinee whose dashboard "Done/Total" numbers don't match
// what the expanded checklist actually shows (e.g. items stuck on "NYD"
// despite the group Plan date being set).
router.post("/:id/resync", async (req, res) => {
  try {
    const existing = await Onboarding.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });
    const updated = await recomputeOnboarding(existing);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ONE-TIME FIX: recompute every record in one call ──────────────────────
router.post("/resync-all", async (req, res) => {
  try {
    const docs = await Onboarding.find();
    let fixed = 0;
    for (const existing of docs) {
      await recomputeOnboarding(existing);
      fixed++;
    }
    res.json({ success: true, message: `Resynced ${fixed} records` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// ONE-TIME LEGACY GOOGLE-SHEET IMPORT MIGRATION
// ============================================================
// Old Google-Sheet-imported records were inserted directly into the
// `onboardings` collection using the sheet's own column names (PascalCase,
// spaces, "Done?" suffixes) instead of this app's camelCase schema fields.
// Mongoose only ever hydrates fields declared in the schema, so these
// records come back from Onboarding.find() with name/dept/checkLists etc.
// all blank — the data is there, just under field names Mongoose ignores.
// This transforms each legacy-shaped document IN PLACE into the current
// schema's shape (same _id), then removes the old junk keys. Safe to
// re-run: after the first run no document has a "Name" field anymore, so
// the filter below matches nothing on subsequent calls.

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLegacyDate(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "NA") return null;

  // Expected legacy format: "22 Jun 26"
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTH_MAP[m[2].toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined) {
      const d = new Date(Date.UTC(year, mon, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toNum(raw, fallback = 0) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  return isNaN(n) ? fallback : n;
}

function toStr(raw) {
  if (raw === undefined || raw === null) return undefined;
  return String(raw).trim();
}

const LEGACY_STRING_FIELDS = {
  "Name": "name",
  "Gender": "gender",
  "Personal Email": "persEmail",
  "Official Email": "officialEmail",
  "Dept": "dept",
  "Designation": "designation",
  "Employee Category": "employeeCategory", // "Intern" is kept as-is, not remapped
  "Name of Buddy": "nameOfBuddy",
  "Authorised System": "laptopPc",
  "Remarks": "remarks",
  "DeptLink": "deptLink",
  "DesignationLink": "designationLink",
  "Confirmation Status": "confirmationStatus",
  "Probation Type": "probationType",
  "Reason for Sal Review Not Applicable": "reasonForSalReview",
  "Next Sal Review Status": "salReviewStatus",
  "Next Sal Review Type": "salReviewType",
  "Sal Type": "salType",
  "Reviewer Name": "reviewerName",
  "Reviewer Email": "reviewerEmail",
  "Notice Period": "noticePeriod",
  "Exit Type": "exitType",
  "Exit Status": "exitStatus",
  "Not Joined Reason": "notJoinedReason",
  "Employee Status": "employeeStatus",
  "You Will transfer Knowledge to": "knowledgeTransferTo",
};

// Legacy columns needing normalization on top of a rename
const LEGACY_NORMALIZED_FIELDS = {
  "Joining Status": {
    destField: "joiningStatus",
    normalize: (v) => (toStr(v) === "Already Joined" ? "Joined" : toStr(v)),
  },
  "FMS Status": {
    destField: "fmsStatus",
    normalize: (v) => {
      const s = toStr(v);
      if (!s) return s;
      return s.toLowerCase() === "closed" ? "Closed" : "Open";
    },
  },
  "Employment Type": {
    destField: "employmentType",
    normalize: (v) => {
      const s = toStr(v);
      return s ? s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase()) : s;
    },
  },
};

const LEGACY_NUMBER_FIELDS = {
  "Annual CTC": "annualCtc",
  "Basic": "basicSal",
  "HRA": "hraSal",
  "Travel Allowance": "travelAllowance",
  "Children's Education Allowance": "childrenEducationAllowance",
  "Supplementary Allowance": "supplementaryAllowance",
  "Gross Monthly": "grossMonthly",
  "Employer PF": "empEpf",
  "Employer ESI": "empEsic",
  "Monthly CTC": "monthlyCtc",
  "Medical Reimbursement Annual": "medicalReimbursement",
  "Vehicle Reimbursement Annual": "vehicleReimbursement",
  "Driver Reimbursement Annual": "driverReimbursement",
  "Telephone Reimbursement Annual": "telephoneReimbursement",
  "Meals Reimbursement Annual": "mealsReimbursement",
  "Uniform Reimbursement Annual": "uniformReimbursement",
  "Leave Travel Allowance Annual": "leaveTravelAllowance",
  "Annual Bonus": "annualBonus",
  "Annual Performance Incentive": "annualPerformanceIncentive",
  "Medical Premium": "medicalPremium",
  "Gratuity": "gratuity",
  "Contract Amount": "contractAmount",
  "Contract Period (months)": "contractPeriod",
  "Equivalent Monthly CTC": "equivalentMonthlyCtc",
  "Probation Duration(in months)": "probationDuration",
};

// Direct summary numbers from the sheet — used as a fallback for records
// with no per-task data (recomputed below whenever task data does exist).
const LEGACY_SUMMARY_NUMBER_FIELDS = {
  "Total Tasks": "totalTasks",
  "Done in Time": "doneInTime",
  "Done but Delayed": "doneButDelayed",
  "Tasks Due": "tasksDue",
  "Tasks Overdue": "tasksOverdue",
  "Not Yet Due": "notYetDue",
  "FMS Score": "fmsScore",
};

// Dates are kept as originally recorded in the sheet — NOT regenerated via
// assignPlanDates()'s day-offset rules, since that would overwrite real
// historical plan dates with guesses.
const LEGACY_DATE_FIELDS = {
  "Offer Accepted Date": "offerAcceptedDate",
  "Planned Joining Date": "plannedJoiningDate",
  "Joined Date": "joinedDate",
  "Planned Confirmation Date": "confirmationDueDate",
  "Planned Exit Date": "plannedExitDate",
  "Left Date": "leftDate",
  "Resignation Email Sent on": "resignationEmailSentOn",
  "Sal Applicable From": "salApplicableFrom",
  "Revision Due Date": "salRevisionDueDate",
};

// Every top-level field the current schema actually declares — anything on
// a legacy raw document that ISN'T in this list gets removed once migrated,
// so no old sheet junk (including odd leftovers like "Employee Ser No")
// lingers in the collection.
const SCHEMA_FIELD_WHITELIST = new Set([
  "_id", "__v", "createdAt", "updatedAt",
  "rowNo", "name", "gender", "persEmail", "mobile", "officialEmail", "dept", "designation",
  "employeeCategory", "nameOfBuddy", "dept_id", "desig_id", "offerAcceptedDate", "plannedJoiningDate",
  "joiningStatus", "exitStatus", "joinedDate", "notJoinedReason", "confirmationStatus", "confirmationSerialNo",
  "reasonForNotApplicable", "probationType", "applicableFrom", "probationDuration", "confirmationDueDate",
  "confirmationHistory", "reviewerName", "reviewerEmail", "salSerialNo", "salType", "salApplicableFrom",
  "annualCtc", "basicSal", "hraSal", "travelAllowance", "childrenEducationAllowance", "supplementaryAllowance",
  "grossMonthly", "empEpf", "empEsic", "monthlyCtc", "medicalReimbursement", "vehicleReimbursement",
  "driverReimbursement", "telephoneReimbursement", "mealsReimbursement", "uniformReimbursement",
  "leaveTravelAllowance", "annualBonus", "annualPerformanceIncentive", "medicalPremium", "gratuity",
  "contractAmount", "contractPeriod", "equivalentMonthlyCtc", "salReviewStatus", "salReviewType",
  "reasonForSalReview", "salRevisionDueDate", "resignationEmailSentOn", "noticePeriod", "leftDate", "exitType",
  "plannedExitDate", "knowledgeTransferTo", "nextPerformanceReviewDate", "laptopPc", "remarks", "totalTasks",
  "doneInTime", "doneButDelayed", "tasksDue", "tasksOverdue", "notYetDue", "fmsStatus", "employeeStatus",
  "employmentType", "fmsScore", "deptLink", "designationLink", "employeesInCc",
  "autoWelcomeEmail", "autoWelcomeEmailSentAt", "autoReminderEmail", "autoReminderEmailSentAt",
  "autoInstructionsToAllEmail", "autoInstructionsToAllEmailSentAt", "employeeConfirmationEmail",
  "employeeConfirmationEmailSentAt", "checkLists",
]);

function buildLegacyChecklists(rawDoc) {
  const template = buildDefaultCheckLists();
  let hasAnyTaskData = false;

  const checkLists = template.map((group) => ({
    name: group.name,
    planDate: null,
    itemsList: group.itemsList.map(({ name: itemName }) => {
      const base = itemName.replace(/\s*Done\?$/, "");
      const planRaw = rawDoc[`${base} Plan?`];
      const doneRaw = rawDoc[`${base} Done?`];
      const scoreRaw = rawDoc[`${base} Score?`];
      const statusRaw = rawDoc[`${base} Status?`];

      if (planRaw !== undefined || doneRaw !== undefined || scoreRaw !== undefined || statusRaw !== undefined) {
        hasAnyTaskData = true;
      }

      const planDate = parseLegacyDate(planRaw);
      const doneDate = parseLegacyDate(doneRaw);

      return {
        name: itemName,
        planDate,
        doneDate,
        score: 0,       // recomputed fresh below via scoreChecklist()
        status: "Pending",
        daysLeft: 0,
        checked: !!doneDate,
      };
    }),
  }));

  return { checkLists, hasAnyTaskData };
}

router.post("/migrate/legacy-import", async (req, res) => {
  try {
    const rawDocs = await Onboarding.collection.find({ Name: { $exists: true } }).toArray();
    let migrated = 0;

    for (const rawDoc of rawDocs) {
      const setFields = {};

      for (const [oldKey, newKey] of Object.entries(LEGACY_STRING_FIELDS)) {
        if (rawDoc[oldKey] !== undefined) {
          const v = toStr(rawDoc[oldKey]);
          if (v !== undefined) setFields[newKey] = v;
        }
      }

      for (const [oldKey, { destField, normalize }] of Object.entries(LEGACY_NORMALIZED_FIELDS)) {
        if (rawDoc[oldKey] !== undefined) {
          const v = normalize(rawDoc[oldKey]);
          if (v !== undefined) setFields[destField] = v;
        }
      }

      for (const [oldKey, newKey] of Object.entries(LEGACY_NUMBER_FIELDS)) {
        if (rawDoc[oldKey] !== undefined) setFields[newKey] = toNum(rawDoc[oldKey], 0);
      }

      for (const [oldKey, newKey] of Object.entries(LEGACY_DATE_FIELDS)) {
        if (rawDoc[oldKey] !== undefined) {
          const d = parseLegacyDate(rawDoc[oldKey]);
          if (d) setFields[newKey] = d;
        }
      }

      if (rawDoc["Mobile"] !== undefined) {
        setFields.mobile = toStr(rawDoc["Mobile"]);
      }

      if (rawDoc["Employees In Cc"] !== undefined) {
        setFields.employeesInCc = String(rawDoc["Employees In Cc"])
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      for (const [oldKey, newKey] of Object.entries(LEGACY_SUMMARY_NUMBER_FIELDS)) {
        if (rawDoc[oldKey] !== undefined) setFields[newKey] = toNum(rawDoc[oldKey], 0);
      }

      // Checklist reconstruction — only recompute fresh scores/statuses when
      // there's real task data to work with. If there's none, leave it
      // empty rather than inventing a fake 42-task skeleton.
      const { checkLists, hasAnyTaskData } = buildLegacyChecklists(rawDoc);
      if (hasAnyTaskData) {
        const today = new Date();
        let doneInTime = 0, doneButDelayed = 0, tasksOverdue = 0,
            tasksDue = 0, notYetDue = 0, fmsScore = 0, tasksNotDone = 0;

        for (const list of checkLists) {
          const r = scoreChecklist(list, today);
          doneInTime += r.doneInTime;
          doneButDelayed += r.doneButDelayed;
          tasksOverdue += r.tasksOverdue;
          tasksDue += r.tasksDue;
          notYetDue += r.notYetDue;
          fmsScore += r.fmsScore;
          tasksNotDone += r.tasksNotDone;
        }

        setFields.checkLists = checkLists;
        setFields.totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
        setFields.doneInTime = doneInTime;
        setFields.doneButDelayed = doneButDelayed;
        setFields.tasksDue = tasksDue;
        setFields.tasksOverdue = tasksOverdue;
        setFields.notYetDue = notYetDue;
        setFields.fmsScore = fmsScore;
        setFields.fmsStatus = (setFields.joiningStatus === "Not Joining" || tasksNotDone === 0)
          ? "Closed" : "Open";
      } else {
        setFields.checkLists = [];
      }

      // Remove everything not part of the current schema.
      const unsetFields = {};
      for (const key of Object.keys(rawDoc)) {
        if (!SCHEMA_FIELD_WHITELIST.has(key)) unsetFields[key] = "";
      }

      await Onboarding.collection.updateOne(
        { _id: rawDoc._id },
        { $set: setFields, $unset: unsetFields }
      );
      migrated++;
    }

    res.json({ success: true, message: `Migrated ${migrated} legacy records` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ONE-TIME BULK ACTION: close every onboarding joined before a date ─────
// Marks fmsStatus = "Closed" for anyone whose joinedDate is earlier than the
// given cutoff. Doesn't touch checklist data or task counts — just flips
// the status, since these are old joiners no longer being actively tracked.
router.post("/close-before-date", async (req, res) => {
  try {
    const cutoff = req.body?.date ? new Date(req.body.date) : new Date("2026-01-01T00:00:00.000Z");
    if (isNaN(cutoff.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }

    const result = await Onboarding.updateMany(
      { joinedDate: { $lt: cutoff }, fmsStatus: { $ne: "Closed" } },
      { $set: { fmsStatus: "Closed" } }
    );

    res.json({
      success: true,
      message: `Closed ${result.modifiedCount} onboarding(s) with joinedDate before ${cutoff.toISOString().slice(0, 10)}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/onboarding/:id ────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await Onboarding.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;