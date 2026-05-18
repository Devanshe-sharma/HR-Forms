const express = require("express");
const Onboarding = require('../models/onboardingModel');
const { triggerNewOnboarding, triggerUpdateOnboarding } = require("../emails");

const router = express.Router();

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

    // 6. Build and save document
    const doc = new Onboarding({
      ...body,
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
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Not found" });

    // Re-use existing checklist structure; only update doneDate on newly ticked itemsList
    const checkLists = existing.checkLists.map((l) => ({
      name: l.name,
      planDate: l.planDate,
      itemsList: l.itemsList.map((it) => ({ ...it })),
    }));

    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        const submittedItems =
            submittedList.items ||
            submittedList.itemsList ||
            [];

          submittedItems.forEach((item, itemIdx) => {
          const target = checkLists[listIdx].itemsList[itemIdx];
          if (!target) return;
          // Only mark done if newly ticked ("new") and not already done
          if (item.checked && item.name === "new" && !target.doneDate) {
            target.doneDate = new Date();
            // Reset computed fields so scoring recalculates
          }
        });
      });
    }

    // Reassign plan dates with potentially updated joining info
    assignPlanDates(
      checkLists,
      body.joiningStatus ?? existing.joiningStatus ?? "",
      body.offerAcceptedDate
        ? new Date(body.offerAcceptedDate)
        : existing.offerAcceptedDate,
      body.joinedDate ? new Date(body.joinedDate) : existing.joinedDate
    );

    // Score
    const today = new Date();
    let doneInTime = 0,
      doneButDelayed = 0,
      tasksOverdue = 0,
      tasksDue = 0,
      notYetDue = 0,
      fmsScore = 0,
      tasksNotDone = 0;

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

    const fmsStatus =
      body.joiningStatus === "Not Joining"
        ? "Closed"
        : tasksNotDone === 0
        ? "Closed"
        : "Open";

    const updated = await Onboarding.findByIdAndUpdate(
      req.params.id,
      {
        ...body,
        offerAcceptedDate: body.offerAcceptedDate
          ? new Date(body.offerAcceptedDate)
          : existing.offerAcceptedDate,
        plannedJoiningDate: body.plannedJoiningDate
          ? new Date(body.plannedJoiningDate)
          : existing.plannedJoiningDate,
        joinedDate: body.joinedDate
          ? new Date(body.joinedDate)
          : existing.joinedDate,
        salApplicableFrom: body.salApplicableFrom
          ? new Date(body.salApplicableFrom)
          : existing.salApplicableFrom,
        confirmationDueDate: body.confirmationDueDate
          ? new Date(body.confirmationDueDate)
          : existing.confirmationDueDate,
        salRevisionDueDate: body.salRevisionDueDate
          ? new Date(body.salRevisionDueDate)
          : existing.salRevisionDueDate,
        checkLists,
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
    triggerUpdateOnboarding(updated).catch(console.error); // fire-and-forget
    res.json({ success: true, data: updated });

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