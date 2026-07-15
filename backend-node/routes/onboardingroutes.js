const express = require("express");
const Onboarding = require('../models/onboardingModel');
const SalaryRevision = require('../models/SalaryRevision');
const { signEmail, verifySignature } = require('../utils/accessLinkSigning');
// Used only by the HR analytics routes, to resolve real historical exit
// dates for headcount-by-quarter reconstruction (Onboarding only stores
// the current status, not the date it happened).
const Exit = require('../models/exitModel');
const { triggerNewOnboarding, triggerUpdateOnboarding } = require("../emails");
const Employee = require('../models/Employee');

const router = express.Router();

// ─── One-time email fields (flag + timestamp pairs) ─────────────────────────
const EMAIL_FIELDS = [
  ["autoWelcomeEmail", "autoWelcomeEmailSentAt"],
  ["autoReminderEmail", "autoReminderEmailSentAt"],
  ["autoInstructionsToAllEmail", "autoInstructionsToAllEmailSentAt"],
  ["employeeConfirmationEmail", "employeeConfirmationEmailSentAt"],
];

const EMAIL_TO_CHECKLIST_ITEM = [
  { flagField: "autoWelcomeEmail", sentAtField: "autoWelcomeEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Welcome Email Done?" },
  { flagField: "autoReminderEmail", sentAtField: "autoReminderEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Reminder Email Done?" },
  { flagField: "autoInstructionsToAllEmail", sentAtField: "autoInstructionsToAllEmailSentAt", listName: "PRE-JOINING TASKS", itemName: "Reminder Email ToAll Done?" },
  { flagField: "employeeConfirmationEmail", sentAtField: "employeeConfirmationEmailSentAt", listName: "POST-JOINING TASKS", itemName: "Employee Confirms All OK Done?" },
];

function syncEmailChecklistItems(checkLists, emailFields) {
  for (const { flagField, sentAtField, listName, itemName } of EMAIL_TO_CHECKLIST_ITEM) {
    if (!emailFields[flagField]) continue;
    const list = checkLists.find((l) => l.name === listName);
    if (!list) continue;
    const item = list.itemsList.find((it) => it.name === itemName);
    if (!item || item.doneDate) continue;
    item.checked = true;
    item.doneDate = emailFields[sentAtField] ? new Date(emailFields[sentAtField]) : new Date();
  }
}

function resolveOneTimeEmails(existing, body) {
  const resolved = {};
  for (const [flagField, sentAtField] of EMAIL_FIELDS) {
    const alreadySent = !!(existing && existing[sentAtField]);
    if (alreadySent) {
      resolved[flagField] = true;
      resolved[sentAtField] = existing[sentAtField];
    } else if (body[flagField]) {
      resolved[flagField] = true;
      resolved[sentAtField] = new Date();
    } else {
      resolved[flagField] = false;
      resolved[sentAtField] = null;
    }
  }
  return resolved;
}

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

function buildDefaultCheckLists() {
  return [
    {
      name: "PRE-JOINING TASKS",
      itemsList: [
        { name: "Welcome Email Done?" },
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

router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const checkLists = buildDefaultCheckLists();

    if (Array.isArray(body.checkLists)) {
      body.checkLists.forEach((submittedList, listIdx) => {
        const submittedItems =
          submittedList.items ||
          submittedList.itemsList ||
          [];

        submittedItems.forEach((item, itemIdx) => {
          const target = checkLists[listIdx]?.itemsList?.[itemIdx];
          if (!target) return;
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

    const emailFields = resolveOneTimeEmails(null, body);
    syncEmailChecklistItems(checkLists, emailFields);

    assignPlanDates(
      checkLists,
      body.joiningStatus ?? "",
      body.offerAcceptedDate ? new Date(body.offerAcceptedDate) : undefined,
      body.joinedDate ? new Date(body.joinedDate) : undefined
    );

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
    const finalStatus =
      body.joiningStatus === "Not Joining" ? "Closed" : fmsStatus;

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
    triggerNewOnboarding(doc).catch(console.error);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/backfill-reporting-head-from-rolemaster", async (req, res) => {
  try {
    const roleRows = await RoleMaster.collection.find({}).toArray();

    const byEmail = new Map();
    const byName = new Map();

    for (const r of roleRows) {
      const reportingManagerRaw =
        r.reporting_manager ??
        r.Reporting_Manager ??
        r["Reporting Manager"] ??
        r.ReportingManager ??
        "";
      const reportingManager = String(reportingManagerRaw || "").trim();
      if (!reportingManager) continue;

      const emailRaw =
        r.desig_email_id ??
        r["desig Email Id"] ??
        r.Desig_Email_Id ??
        r.DesigEmailId ??
        r.desigEmailId ??
        "";
      const email = String(emailRaw || "").trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, reportingManager);

      const nameRaw = r.emp_name ?? r.Emp_name ?? r.Emp_Name ?? r.EmpName ?? "";
      const name = String(nameRaw || "").trim().toLowerCase();
      if (name && !byName.has(name)) byName.set(name, reportingManager);
    }

    const candidates = await Onboarding.find(
      { $or: [{ reportingHead: { $exists: false } }, { reportingHead: "" }] },
      "name officialEmail persEmail"
    );

    let updated = 0;
    const unmatched = [];

    for (const doc of candidates) {
      const email = (doc.officialEmail || "").trim().toLowerCase();
      const name = (doc.name || "").trim().toLowerCase();

      const reportingManager = (email && byEmail.get(email)) || (name && byName.get(name));

      if (reportingManager) {
        await Onboarding.findByIdAndUpdate(doc._id, { reportingHead: reportingManager });
        updated++;
      } else {
        unmatched.push(doc.name);
      }
    }

    res.json({
      success: true,
      message: `Backfilled reportingHead on ${updated} record(s). ${unmatched.length} had no match in Role Master.`,
      unmatched,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/backfill-empid-from-rolemaster", async (req, res) => {
  try {
    const roleRows = await RoleMaster.collection.find({}).toArray();

    const byEmail = new Map();
    const byName = new Map();

    for (const r of roleRows) {
      const empIdRaw = r.emp_id ?? r.Emp_id ?? r.Emp_Id ?? r.EmpId ?? "";
      const empId = String(empIdRaw || "").trim();
      if (!empId) continue;

      const emailRaw =
        r.desig_email_id ??
        r["desig Email Id"] ??
        r.Desig_Email_Id ??
        r.DesigEmailId ??
        r.desigEmailId ??
        "";
      const email = String(emailRaw || "").trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, empId);

      const nameRaw = r.emp_name ?? r.Emp_name ?? r.Emp_Name ?? r.EmpName ?? "";
      const name = String(nameRaw || "").trim().toLowerCase();
      if (name && !byName.has(name)) byName.set(name, empId);
    }

    const candidates = await Onboarding.find(
      { $or: [{ empId: { $exists: false } }, { empId: "" }] },
      "name officialEmail persEmail"
    );

    let updated = 0;
    const unmatched = [];

    for (const doc of candidates) {
      const email = (doc.officialEmail || "").trim().toLowerCase();
      const name = (doc.name || "").trim().toLowerCase();

      const empId = (email && byEmail.get(email)) || (name && byName.get(name));

      if (empId) {
        await Onboarding.findByIdAndUpdate(doc._id, { empId });
        updated++;
      } else {
        unmatched.push(doc.name);
      }
    }

    res.json({
      success: true,
      message: `Backfilled empId on ${updated} record(s). ${unmatched.length} had no match in Role Master.`,
      unmatched,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const EXITED_STATUS_VALUES = new Set(["Left", "Already Left"]);

router.get("/employee-letters-source", async (req, res) => {
  try {
    const docs = await Onboarding.find(
      {},
      "name empId dept designation mobile joinedDate employeeCategory exitStatus " +
      "annualCtc monthlyCtc basicSal hraSal travelAllowance childrenEducationAllowance " +
      "grossMonthly empEpf empEsic medicalReimbursement vehicleReimbursement " +
      "driverReimbursement telephoneReimbursement mealsReimbursement uniformReimbursement " +
      "leaveTravelAllowance annualBonus annualPerformanceIncentive medicalPremium gratuity " +
      "contractAmount contractPeriod salApplicableFrom"
    ).lean();

    const employees = docs.map((d) => {
      const isExited = EXITED_STATUS_VALUES.has(d.exitStatus || "");
      return {
        _id: String(d._id),
        employee_id: d.empId || String(d._id),
        full_name: d.name || "",
        department: d.dept || "",
        designation: d.designation || "",
        mobile: d.mobile || "",
        joining_date: d.joinedDate || null,
        employee_category: d.employeeCategory || "",
        is_current: !isExited,
        is_exited: isExited,

        annual_ctc: d.annualCtc || 0,
        monthly_ctc: d.monthlyCtc || 0,
        basic: d.basicSal ?? "",
        hra: d.hraSal ?? "",
        travel_allowance: d.travelAllowance ?? "",
        childrens_education_allowance: d.childrenEducationAllowance ?? "",
        gross_monthly: d.grossMonthly ?? "",
        employer_pf: d.empEpf ?? "",
        employer_esi: d.empEsic ?? "",
        telephone_allowance: d.telephoneReimbursement ?? "",
        telephone_reimbursement_annual: d.telephoneReimbursement ?? "",
        medical_reimbursement_annual: d.medicalReimbursement ?? "",
        vehicle_reimbursement_annual: d.vehicleReimbursement ?? "",
        driver_reimbursement_annual: d.driverReimbursement ?? "",
        meals_reimbursement_annual: d.mealsReimbursement ?? "",
        uniform_reimbursement_annual: d.uniformReimbursement ?? "",
        leave_travel_allowance_annual: d.leaveTravelAllowance ?? "",
        annual_bonus: d.annualBonus ?? "",
        annual_performance_incentive: d.annualPerformanceIncentive ?? "",
        medical_premium: d.medicalPremium ?? "",
        gratuity: d.gratuity ?? "",
        contract_amount: d.contractAmount ?? null,
        contract_period_months: d.contractPeriod ?? null,
        sal_applicable_from: d.salApplicableFrom || null,
      };
    });

    res.json({ success: true, data: employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/eligible-employees", async (req, res) => {
  try {
    const docs = await Onboarding.find({ joiningStatus: "Joined" })
      .select(
        "name dept designation officialEmail persEmail joinedDate employeeCategory exitStatus managementLevel " +
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
      management_level: d.managementLevel || "",
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

router.post(
  "/sync-dept-and-exitstatus-from-sheet",
  express.text({ type: "*/*", limit: "10mb" }),
  async (req, res) => {
  try {
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
      relax_quotes: true,
    });

    const all = await Onboarding.find({}, "name officialEmail persEmail dept exitStatus joinedDate").lean();

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
        const exitRefDate = parseSheetDate(row["Left Date"]) || parseSheetDate(row["Planned Exit Date"]) || parseSheetDate(row["Resignation Email Sent on"]);
        const joinedDate = match.joinedDate ? new Date(match.joinedDate) : null;

        if (joinedDate && exitRefDate && joinedDate > exitRefDate) {
          skippedRehires.push(name);
        } else {
          setFields.exitStatus = sheetExitStatus;
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

const RoleMaster = require("../models/role_master");

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
      map.set(dept, type);
    } else if (!map.has(dept)) {
      map.set(dept, "");
    }
  }
  return map;
}

const DEPARTMENT_ALIASES = {
  "tcs": "temporary staffing",
  "daa": "data analytics and automation",
  "admin": "administration",
  "recruitment": "recruitment services",
  "hr": "human resources",
  "design & develpoment": "engineering",
  "support": "administration",
};

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

function quarterEndDate(year, quarter) {
  const endMonth = quarter * 3;
  return new Date(Date.UTC(year, endMonth, 0, 23, 59, 59));
}

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
        if (joined > asOf) continue;

        if (emp.isMarkedExited) {
          if (emp.resolvedExitDate) {
            if (emp.resolvedExitDate <= asOf) continue;
          } else {
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

router.get("/analytics/gender", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const docs = await Onboarding.find(
      {},
      "gender dept joinedDate joiningStatus exitStatus persEmail officialEmail"
    ).lean();

    const exits = await Exit.find(
      {},
      "persEmail officialEmail leftDate plannedExitDate resignationDate"
    ).lean();

    const EXITED = new Set(["Left", "Already Left"]);

    const exitDateOfRecord = (e) => {
      const d = e.leftDate || e.plannedExitDate || e.resignationDate;
      const t = d ? new Date(d).getTime() : NaN;
      return isNaN(t) ? -Infinity : t;
    };

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

    const employees = docs.map((d) => ({
      ...d,
      isMarkedExited: EXITED.has(d.exitStatus || ""),
      resolvedExitDate: EXITED.has(d.exitStatus || "") ? resolveExitDate(d) : null,
    }));

    const quarters = [1, 2, 3, 4].map((q) => {
      const asOf = quarterEndDate(year, q);
      const genderCounts = {};

      for (const emp of employees) {
        if (!emp.joinedDate) continue;
        const joined = new Date(emp.joinedDate);
        if (joined > asOf) continue;

        if (emp.isMarkedExited) {
          if (emp.resolvedExitDate) {
            if (emp.resolvedExitDate <= asOf) continue;
          } else {
            continue;
          }
        }

        const g = (emp.gender || "").trim() || "Not Specified";
        genderCounts[g] = (genderCounts[g] || 0) + 1;
      }

      const total = Object.values(genderCounts).reduce((s, c) => s + c, 0);

      return {
        quarter: `Q${q}`,
        asOf: asOf.toISOString(),
        total,
        genderCounts,
      };
    });

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

    const joinYears = docs
      .map((d) => (d.joinedDate ? new Date(d.joinedDate).getFullYear() : null))
      .filter(Boolean);
    const minYear = joinYears.length ? Math.min(...joinYears) : year;
    const maxYear = Math.max(new Date().getFullYear(), ...(joinYears.length ? joinYears : [year]));
    const availableYears = [];
    for (let y = maxYear; y >= minYear; y--) availableYears.push(y);

    res.json({
      success: true,
      year,
      quarters,
      availableYears,
      total: current.length,
      genders,
      overall,
      byDepartment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/verify-access", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    const sig = req.query.sig || "";

    if (!email) {
      return res.json({ success: true, allowed: false, reason: "missing_email" });
    }

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
      "name empId dept designation officialEmail persEmail mobile joiningStatus exitStatus joinedDate reportingHead employeeCategory managementLevel"
    ).lean();

    const employees = docs.map((d) => {
      const isExited = EXITED_STATUS_VALUES.has(d.exitStatus || "");
      const isCurrent = d.joiningStatus === "Joined" && !isExited;
      return {
        _id: String(d._id),
        employee_id: d.empId || String(d._id),
        full_name: d.name || "",
        department: d.dept || "",
        designation: d.designation || "",
        official_email: d.officialEmail || "",
        personal_email: d.persEmail || "",
        email: d.officialEmail || d.persEmail || "",
        mobile: d.mobile || "",
        joining_date: d.joinedDate || null,
        employee_category: d.employeeCategory || "",
        management_level: d.managementLevel || "",
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

router.put("/:id", async (req, res) => {
  try {
    const body = req.body;
    const existing = await Onboarding.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    const newStatus = body.joiningStatus;
    const wasNotJoined = existing.joiningStatus !== 'Joined';

    if (newStatus === 'Joined' && wasNotJoined) {
      const empExists = await Employee.findOne({
        $or: [
          { official_email: existing.officialEmail },
          { employee_id:    body.emp_id || existing.emp_id || '' },
        ].filter(c => Object.values(c)[0])
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
          management_level: existing.managementLevel                      || '',
          name_of_buddy:     existing.nameOfBuddy                        || '',
          joining_status:    'Joined',
          isArchived:        false,
        });
        console.log(`[Onboarding] ✅ Employee record created for ${existing.name}`);
      } else {
        await Employee.findByIdAndUpdate(empExists._id, {
          joining_status: 'Joined',
          joining_date:   body.joinedDate || existing.joinedDate || empExists.joining_date,
        });
        console.log(`[Onboarding] ✅ Employee record updated for ${existing.name}`);
      }
    }

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

    if (process.env.SEND_UPDATE_ONBOARDING_EMAILS !== 'false') {
      triggerUpdateOnboarding(updated).catch(console.error);
    }
    res.json({ success: true, data: updated });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/analytics/interns", async (req, res) => {
  try {
    const docs = await Onboarding.find(
      {},
      "employeeCategory dept joiningStatus exitStatus"
    ).lean();

    const current = docs.filter(
      (d) => d.joiningStatus === "Joined" && !EXITED_STATUS_VALUES.has(d.exitStatus || "")
    );

    const isIntern = (d) => (d.employeeCategory || "").trim().toLowerCase() === "intern";

    const total = current.length;
    const internsCount = current.filter(isIntern).length;
    const internPct = total > 0 ? Math.round((internsCount / total) * 1000) / 10 : 0;

    const byDept = {};
    for (const d of current) {
      const dept = (d.dept || "").trim() || "Unassigned";
      if (!byDept[dept]) byDept[dept] = { department: dept, interns: 0, total: 0 };
      byDept[dept].total++;
      if (isIntern(d)) byDept[dept].interns++;
    }
    const departmentBreakdown = Object.values(byDept)
      .map((row) => ({
        ...row,
        pct: row.total > 0 ? Math.round((row.interns / row.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.interns - a.interns || a.department.localeCompare(b.department));

    res.json({
      success: true,
      total,
      internsCount,
      internPct,
      nonInternsCount: total - internsCount,
      departmentBreakdown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

async function recomputeOnboarding(existing) {
  const existingPlain = existing.toObject();
  const checkLists = toPlainCheckLists(existingPlain.checkLists);

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

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLegacyDate(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "NA") return null;

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
  "Employee Category": "employeeCategory",
  "Management Level": "managementLevel",
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

const LEGACY_SUMMARY_NUMBER_FIELDS = {
  "Total Tasks": "totalTasks",
  "Done in Time": "doneInTime",
  "Done but Delayed": "doneButDelayed",
  "Tasks Due": "tasksDue",
  "Tasks Overdue": "tasksOverdue",
  "Not Yet Due": "notYetDue",
  "FMS Score": "fmsScore",
};

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
  "managementLevel",
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
        score: 0,
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

router.delete("/:id", async (req, res) => {
  try {
    await Onboarding.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/analytics/intern-conversions", async (req, res) => {
  try {
    const CONVERTIBLE_FROM = ["Intern", "Contract Based"];

    const revisions = await SalaryRevision.find(
      { categoryChanged: true },
      "onboardingId previousCategory newCategory createdAt applicableDate"
    ).lean();

    const current = await Onboarding.find(
      {},
      "name dept employeeCategory joiningStatus exitStatus"
    ).lean();

    const currentById = new Map(current.map((c) => [String(c._id), c]));

    const byEmployee = new Map();
    for (const r of revisions) {
      if (!r.onboardingId) continue;
      if (!CONVERTIBLE_FROM.includes(r.previousCategory)) continue;
      if (r.newCategory !== "Employee") continue;

      const key = String(r.onboardingId);
      const existing = byEmployee.get(key);
      if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
        byEmployee.set(key, r);
      }
    }

    const conversions = [];
    for (const [onboardingId, r] of byEmployee) {
      const emp = currentById.get(onboardingId);
      if (!emp) continue;
      if (EXITED_STATUS_VALUES.has(emp.exitStatus || "")) continue;
      if (emp.employeeCategory !== "Employee") continue;

      conversions.push({
        name: emp.name,
        department: emp.dept || "",
        previousCategory: r.previousCategory,
        conversionDate: r.applicableDate || r.createdAt || null,
      });
    }

    conversions.sort(
      (a, b) => new Date(b.conversionDate || 0).getTime() - new Date(a.conversionDate || 0).getTime()
    );

    const byDept = {};
    for (const c of conversions) {
      const dept = c.department || "Unassigned";
      byDept[dept] = (byDept[dept] || 0) + 1;
    }
    const departmentBreakdown = Object.entries(byDept)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      total: conversions.length,
      conversions,
      departmentBreakdown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;