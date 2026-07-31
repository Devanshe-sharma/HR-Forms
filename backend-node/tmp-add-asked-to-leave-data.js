require('dotenv').config();
const mongoose = require('mongoose');
const Exit = require('./models/exitModel');

// One-time historical backfill of confidential "Asked to Leave" data from
// HR's "HR Processes Master" sheet. Only applied to names confirmed
// against existing Exit records (see conversation for the name-matching
// decisions on Ishaan Agarwal / Parul Tiwari; Satinder Singh and Jyoti
// Sodhe were deliberately skipped — no reliable/no existing Exit record).

const REASON = "Attitude (Refused to take ownership)";

const UPDATES = [
  {
    _id: "6a4651bc0730b454d7308adb", // Navneet Sharma
    detail:
      'Wrong Hire. Suited tp Admin NOT Sales. Generated 0 meaningful Leads. Practically never visited the primary clients: Army HQ/ BSF/CRPF/NDRF. Focused only Navy (easy option). Excessive focus on own admin / "privileges". Closed 0 Leads',
  },
  {
    _id: "6a4cca52e4fbbc3bfc85d240", // Siddharth  Kumar
    detail:
      'Wrong hire. Words & Actions are completely divergent. Found 0 meaningful Clients in 1 year (whereas others were able to shortlist clients in a day). Placed a 20L order without even verifying the client - money still stuck. Generated 10-min "ChatGPT" soluitions for everything. No initiative - worked when aksed. Not interested. Spent most of his time on Shares / other pursuits to make money. Also, a "Complainer". Everything was someone else\'s mistake.',
  },
  {
    _id: "6a4651bc0730b454d7308adf", // Ishaan Agarwal (CSV: Ishaan Sharma)
    detail:
      'Slow, Undependable. Work quality was almost invariably extremely poor - eg, took weeks to product a poor module package design. Not a Team-person. Mostly did only his own work. Did not contribute voluntarily.',
  },
  {
    _id: "6a4651bc0730b454d7308adc", // Anusha Barwal
    detail:
      'Very pleasant. However Unethical. Fudged own attendance and lied about it (along with her reportee). Not a manager. Passed on all work to her reportee. Did good work when asked, therefore had the capability, but chose to NOT take the initiative.',
  },
  {
    _id: "6a4651bc0730b454d7308ae3", // Diksha Kamra
    detail:
      'Very pleasant. But very immature, even Unethical. Fudged own attendance and lied about it. Discontinued almost all HR processes, The company had a huge problem reinstating those. Immature - no confidentiality with employees. Very inclined towards organising "parties/events". For most other work, was extremely inefficient and ineffective. However, very likable, and liked by most - a people pleaser.',
  },
];

function buildDefaultCheckLists() {
  const DEFS = [
    { name: "PRE-EXIT TASKS", items: [
      "Exit Email Done?", "Reminder Email Done?", "Take a Printout of Exit Email Done?",
      "Exit Email to All Dept Cc Done?", "Get a Handing Over Done from Employee?",
      "Conducting Exit Interview with Mgmt Done?",
    ]},
    { name: "EXIT-DAY TASKS", items: [
      "Sign Exit Form Done?", "Sign No Dues Certificate Done?", "Ensure All Assets Are Returned Done?",
      "Name Deleted from Employee List Done?", "Tea Party Done?", "SIM Returned Done?",
    ]},
    { name: "POST-EXIT TASKS", items: [
      "Close the Contract on Odoo Done?", "Reassign Assets Done?", "Sent an Approval Mail to Mgmt Done?",
      "Issue FnF Salary Done?", "Issue Experience Letter Done?", "Reallotment of Delegation & Checklist Task Done?",
      "Remove Email from Google Drive Done?", "Remove Biometric Access Done?", "Change S2ndLife Password Done?",
      "Remove ERP Password Done?", "Archive Employee Profile Done?", "Remove the Access from Shared Contacts Done?",
      "Delete Email from BO Domain Done?", "Remove Employee from BO WhatsApp Gp Done?",
    ]},
  ];
  return DEFS.map((g) => ({ name: g.name, planDate: null, itemsList: g.items.map((name) => ({ name })) }));
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const u of UPDATES) {
    const res = await Exit.findByIdAndUpdate(
      u._id,
      { exitType: "Asked to Leave", reasonAskedToLeave: REASON, reasonAskedToLeaveDetail: u.detail },
      { new: true }
    );
    console.log(res ? `Updated ${res.name} (${u._id})` : `NOT FOUND: ${u._id}`);
  }

  // Parul Tiwari — no existing Exit record; create one from her Onboarding data.
  const existingParul = await Exit.findOne({ name: /^Parul Tiwari$/i });
  if (existingParul) {
    console.log("Parul Tiwari Exit record already exists, skipping create:", existingParul._id.toString());
  } else {
    const checkLists = buildDefaultCheckLists();
    const totalTasks = checkLists.reduce((s, l) => s + l.itemsList.length, 0);
    const parul = new Exit({
      name: "Parul Tiwari",
      gender: "Female",
      persEmail: "parultiwari083@gmail.com",
      mobile: "8959979968",
      officialEmail: "hr.head@briskolive.com",
      dept: "Human Resources",
      designation: "Manager HR",
      employmentType: "Full Time Employment",
      joiningDate: new Date("2025-04-07T00:00:00.000Z"),
      exitStatus: "Left",
      exitType: "Asked to Leave",
      reasonAskedToLeave: REASON,
      reasonAskedToLeaveDetail:
        "Unsuited to HR function - rarely, if ever spoke to employees, often even rude to them. Quite unprofessional. Newly married, but husband used to join her for lunch in working time. Achieved hardly anything, therefore was one of the rare onew who was asked to leave.",
      hr_approved_at: new Date(),
      checkLists,
      totalTasks,
      fmsStatus: "Closed",
    });
    await parul.save();
    console.log("Created Parul Tiwari Exit record:", parul._id.toString());
  }

  await mongoose.disconnect();
}
run().catch((err) => { console.error(err); process.exit(1); });
