require('dotenv').config();
const mongoose = require('mongoose');
const Onboarding = require('./models/onboardingModel');
const SalaryRevision = require('./models/SalaryRevision');

// One-time historical backfill from HR's "HR Processes Master" sheet:
//  1) Referred-employee performance/reason data onto Onboarding (confidential
//     fields — see onboardingModel.js comment).
//  2) Two active PIPs (Sumit Kumar, Adesh Kumar Gupta) onto SalaryRevision.
// See conversation for the name-matching decisions (Adesh Kumar Chopra ->
// Adesh Kumar Gupta, Rasool Ahamed -> Rasool Ahmad; Liladhar Bachkheti
// skipped — no matching record anywhere in the system).

const REFERRALS = [
  { _id: "6a41e8e005a36d95f3b01490", performance: "Excellent", reason: "" }, // Raju Pandey
  { _id: "6a41e8e005a36d95f3b01481", performance: "Average", reason: "" }, // Mukesh Kumar
  {
    _id: "6a41e8e005a36d95f3b0148e", // Rajeev Kumar
    performance: "Average",
    reason: "Extremely diligent. Not an initiative taker. Did not get along with Supervisor (Operations Head)",
  },
  {
    _id: "6a41e8e005a36d95f3b0144c", // Adesh Kumar Gupta (CSV: Adesh Kumar Chopra)
    performance: "Below Average",
    reason: 'Wrong fit for position. Hired due to "halo" effect.',
  },
  {
    _id: "6a41e8e005a36d95f3b01492", // Rasool Ahmad (CSV: Rasool Ahamed)
    performance: "Average",
    reason: 'Diligent. Good in field. Has propensity for "politics". Needs to be kept in check on that account.',
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  // ── 1) Referral backfill ──────────────────────────────────────────────
  for (const r of REFERRALS) {
    const doc = await Onboarding.findByIdAndUpdate(
      r._id,
      { referred: true, referredPerformance: r.performance, referredReason: r.reason },
      { new: true }
    );
    console.log(doc ? `Referred: updated ${doc.name}` : `Referred: NOT FOUND ${r._id}`);
  }

  // ── 2) PIP: Sumit Kumar — new record, 15 May 2026 for 3 months ────────
  const sumitOnboarding = await Onboarding.findById("6a41e8e005a36d95f3b014a1").lean();
  const sumitExisting = await SalaryRevision.findOne({
    employeeName: "Sumit Kumar",
    stage: "on_hold",
  });
  if (sumitExisting) {
    console.log("PIP: Sumit Kumar already has an on_hold record, skipping create:", sumitExisting._id.toString());
  } else {
    const sumitPip = new SalaryRevision({
      onboardingId: sumitOnboarding._id,
      employeeCode: String(sumitOnboarding._id),
      employeeName: sumitOnboarding.name,
      department: sumitOnboarding.dept,
      designation: sumitOnboarding.designation,
      email: sumitOnboarding.officialEmail,
      joiningDate: sumitOnboarding.joinedDate,
      contractStartDate: sumitOnboarding.contractStartDate,
      contractEndDate: sumitOnboarding.contractEndDate,
      category: sumitOnboarding.employeeCategory || "Employee",
      previousCategory: sumitOnboarding.employeeCategory || "Employee",
      previousDesignation: sumitOnboarding.designation,
      previousReportingHead: sumitOnboarding.reportingHead || "",
      previousCtc: sumitOnboarding.annualCtc,
      stage: "on_hold",
      reviewDate: new Date("2026-08-15T00:00:00.000Z"),
      managerDecision: {
        decision: "pip",
        pipDurationMonths: 3,
        pipNewDueDate: new Date("2026-08-15T00:00:00.000Z"),
        reason: "On PIP",
        submittedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
      managementDecision: {
        pipApproved: true,
        reason: "Approved",
        submittedAt: new Date("2026-05-15T00:00:00.000Z"),
      },
      created_by: "HR Manual Entry",
      createdBy: "HR Manual Entry",
      updated_by: "HR Manual Entry",
      updatedBy: "HR Manual Entry",
    });
    await sumitPip.save();
    console.log("PIP: created Sumit Kumar on_hold record:", sumitPip._id.toString());
  }

  // ── 3) PIP: Adesh Kumar Gupta — existing pending_manager record, 7 Jul
  //     2026 for 1 month ────────────────────────────────────────────────
  const adeshUpdated = await SalaryRevision.findByIdAndUpdate(
    "6a6b5ed6140c90911ba7bd79",
    {
      stage: "on_hold",
      reviewDate: new Date("2026-08-07T00:00:00.000Z"),
      managerDecision: {
        decision: "pip",
        pipDurationMonths: 1,
        pipNewDueDate: new Date("2026-08-07T00:00:00.000Z"),
        reason: "On PIP",
        submittedAt: new Date("2026-07-07T00:00:00.000Z"),
      },
      managementDecision: {
        pipApproved: true,
        reason: "Approved",
        submittedAt: new Date("2026-07-07T00:00:00.000Z"),
      },
    },
    { new: true }
  );
  console.log(adeshUpdated ? `PIP: updated Adesh Kumar Gupta record ${adeshUpdated._id}` : "PIP: Adesh record NOT FOUND");

  await mongoose.disconnect();
}
run().catch((err) => { console.error(err); process.exit(1); });
