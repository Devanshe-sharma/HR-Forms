const express = require("express");
const Onboarding = require('../models/onboardingModel');
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

    // 3. Assign plan dates
    assignPlanDates(
      checkLists,
      body.joiningStatus ?? "",
      body.offerAcceptedDate ? new Date(body.offerAcceptedDate) : undefined,
      body.joinedDate ? new Date(body.joinedDate) : undefined
    );

    // 4. Score every list
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

    // 5. If "Not Joining" override to Closed
    const finalStatus =
      body.joiningStatus === "Not Joining" ? "Closed" : fmsStatus;

    // 6. Resolve one-time email flags (fresh record, so this is just:
    //    ticked now => sent now)
    const emailFields = resolveOneTimeEmails(null, body);

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

// ─── GET /api/onboarding  — List all (open first) ─────────────────────────
router.get("/", async (req, res) => {
  try {
    const docs = await Onboarding.find()
      .sort({ fmsStatus: 1, createdAt: -1 })
       // lighter list view
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

    // One-time emails: never unsend, never re-date, once sent always "Done".
    const emailFields = resolveOneTimeEmails(existingPlain, body);

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