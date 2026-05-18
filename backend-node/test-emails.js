require("dotenv").config();

// ── TEST OVERRIDES — all emails go to dev inbox only ─────────────────────────
process.env.HR_EMAIL  = "devanshesharma6@gmail.com";
process.env.ALL_EMAIL = "devanshesharma6@gmail.com";

const { triggerNewOnboarding, triggerUpdateOnboarding } = require("./emails");

const mockDoc = {
  _id: "test123",
  name: "Rahul Sharma",
  dept: "Technology",
  designation: "Software Engineer",
  employeeCategory: "Employee",
  gender: "Male",
  mobile: "9999999999",
  persEmail: "devanshesharma6@gmail.com",
  officialEmail: "devanshesharma6@gmail.com",
  nameOfBuddy: "Devanshe Sharma",
  joiningStatus: "Yet To Join Office",
  fmsStatus: "Open",
  fmsScore: -2,
  totalTasks: 42,
  doneInTime: 5,
  doneButDelayed: 1,
  tasksOverdue: 2,
  tasksDue: 10,
  notYetDue: 24,
  offerAcceptedDate: new Date("2026-05-10"),
  plannedJoiningDate: new Date("2026-05-20"),
  joinedDate: null,
  notJoinedReason: "",
  remarks: "Joining from Bangalore",
  employeesInCc: [],

  autoWelcomeEmail: true,
  autoReminderEmail: true,
  autoInstructionsToAllEmail: true,
  employeeConfirmationEmail: true,

  checkLists: [
    {
      name: "PRE-JOINING TASKS",
      planDate: new Date("2026-05-15"),
      itemsList: [
        { name: "Welcome Email Done?",     status: "DONE",        score: 2,  doneDate: new Date("2026-05-13"), planDate: new Date("2026-05-15") },
        { name: "Reminder Email Done?",    status: "OVERDUE",     score: -1, doneDate: null,                   planDate: new Date("2026-05-14") },
        { name: "Blood Gp Reminder Done?", status: "PENDING",     score: 0,  doneDate: null,                   planDate: new Date("2026-05-20") },
        { name: "Photos Reminder Done?",   status: "NOT YET DUE", score: 0,  doneDate: null,                   planDate: null },
      ],
    },
    {
      name: "JOINING-DAY TASKS",
      planDate: new Date("2026-06-04"),
      itemsList: [
        { name: "New BO Email Done?",       status: "NOT YET DUE", score: 0, doneDate: null, planDate: new Date("2026-06-04") },
        { name: "Odoo Profile Photo Done?", status: "NOT YET DUE", score: 0, doneDate: null, planDate: new Date("2026-06-04") },
      ],
    },
  ],
};

async function run() {
  console.log("\n🧪 Testing triggerNewOnboarding...");
  console.log("   joiningStatus            :", mockDoc.joiningStatus);
  console.log("   persEmail                :", mockDoc.persEmail);
  console.log("   HR_EMAIL  (overridden)   :", process.env.HR_EMAIL);
  console.log("   ALL_EMAIL (overridden)   :", process.env.ALL_EMAIL);
  console.log("   employeesInCc            :", mockDoc.employeesInCc);
  console.log("");

  await triggerNewOnboarding(mockDoc);
  console.log("✅ triggerNewOnboarding done — check devanshesharma6@gmail.com\n");

  console.log("🧪 Testing triggerUpdateOnboarding...");
  await triggerUpdateOnboarding(mockDoc);
  console.log("✅ triggerUpdateOnboarding done — check devanshesharma6@gmail.com\n");
}

run().catch(console.error);