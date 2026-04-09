const express = require("express");
const Onboarding = require("../models/Onboardingmodel");

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

  for (const item of list.items) {
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
        item.daysLeft = "NA";

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
        item.daysLeft = "NA";
        doneInTime++;
      } else {
        item.score = 0;
        item.status = "NOT YET DUE";
        item.daysLeft = "NA";
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
      items: [
        { doneHeader: "Welcome Email Done?" },
        { doneHeader: "Reminder Email Done?" },
        { doneHeader: "Blood Gp Reminder Done?" },
        { doneHeader: "Photos Reminder Done?" },
        { doneHeader: "Photo Formal Dress Done?" },
        { doneHeader: "Reminder Email ToAll Done?" },
        { doneHeader: "Verification Of Document Done?" },
      ],
    },
    {
      name: "JOINING-DAY TASKS",
      items: [
        { doneHeader: "New BO Email Done?" },
        { doneHeader: "Odoo Profile Photo Done?" },
        { doneHeader: "Odoo Blood Gp Entry Done?" },
        { doneHeader: "Odoo Profile 100% Done?" },
        { doneHeader: "Odoo Salary/Contract Done?" },
        { doneHeader: "EFP Forms 2/11 Done?" },
        { doneHeader: "Employees List Done?" },
        { doneHeader: "Seating Done?" },
        { doneHeader: "System Issued if Applicable Done?" },
        { doneHeader: "BO Presentation Done?" },
        { doneHeader: "Employees Hullo Done?" },
        { doneHeader: "Employee PAN Card Done?" },
      ],
    },
    {
      name: "POST-JOINING TASKS",
      items: [
        { doneHeader: "T-Shirt Issue Done?" },
        { doneHeader: "Welcome Kit Issue Done?" },
        { doneHeader: "Odoo Eqpt Entry Done?" },
        { doneHeader: "Contract/Appt Issue Done?" },
        { doneHeader: "Employee File Done?" },
        { doneHeader: "Biometric Done?" },
        { doneHeader: "Dept Onboarding Done?" },
        { doneHeader: "Role Briefing Done?" },
        { doneHeader: "Amend LinkedIn Profile Done?" },
        { doneHeader: "Add Email for Google Contacts Sharing if Applicable Done?" },
        { doneHeader: "Taken Over from Exiting Employee, If Applicable Done?" },
        { doneHeader: "DME: Checklists/ Delegation Passwords Done?" },
        { doneHeader: "Dept: Allocate Checklist/ Delegation Done?" },
        { doneHeader: "Allocate Buddy Done?" },
        { doneHeader: "Employee Confirms All OK Done?" },
        { doneHeader: "Onboarding Test Done?" },
        { doneHeader: "Emailed All Clients New Member Has Joined if Applicable Done?" },
        { doneHeader: "Coffee With Directors Done?" },
        { doneHeader: "Check if UAN Applicable Done?" },
        { doneHeader: "UAN (PF) if applicable completed Done?" },
        { doneHeader: "KYC (PF) if applicable completed Done?" },
      ],
    },
    {
      name: "FINAL-JOINING TASKS",
      items: [
        { doneHeader: "Medical Insurance Card Issued if Applicable Done?" },
        { doneHeader: "First Salary Transfer Done?" },
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
      for (const item of list.items) {
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

    // 2. Map submitted done-states (array of booleans per list) onto items
    //    Frontend sends: checkLists: [ { items: [true, false, ...] }, ... ]
    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        if (!Array.isArray(submittedList.items)) return;
        submittedList.items.forEach((checked, itemIdx) => {
          if (checked && checkLists[listIdx].items[itemIdx]) {
            checkLists[listIdx].items[itemIdx].doneDate = new Date();
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

    const totalTasks = checkLists.reduce((s, l) => s + l.items.length, 0);

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
      .select("-checkLists"); // lighter list view
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

// ─── PUT /api/onboarding/:id  — Update onboarding ─────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const body = req.body;
    const existing = await Onboarding.findById(req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Not found" });

    // Re-use existing checklist structure; only update doneDate on newly ticked items
    const checkLists = existing.checkLists.map((l) => ({
      name: l.name,
      planDate: l.planDate,
      items: l.items.map((it) => ({ ...it })),
    }));

    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        if (!Array.isArray(submittedList.items)) return;
        submittedList.items.forEach((item, itemIdx) => {
          const target = checkLists[listIdx].items[itemIdx];
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