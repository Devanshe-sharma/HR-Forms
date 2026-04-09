const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Sub-schema: a single checklist item ───────────────────────────────────
const CheckItemSchema = new Schema(
  {
    doneHeader: { type: String, required: true },
    planDate: Date,
    doneDate: Date,
    score: Number,
    status: String,
    daysLeft: Schema.Types.Mixed,
  },
  { _id: false }
);

// ─── Sub-schema: a checklist group ────────────────────────────────────────
const CheckListSchema = new Schema(
  {
    name: { type: String, required: true },
    planDate: Date,
    items: [CheckItemSchema],
  },
  { _id: false }
);

// ─── Main Onboarding document ──────────────────────────────────────────────
const OnboardingSchema = new Schema(
  {
    // Basic
    name: { type: String, required: true, trim: true },
    persEmail: { type: String, trim: true },
    mobile: { type: String, trim: true },
    gender: String,
    officialEmail: { type: String, trim: true },
    nameOfBuddy: String,

    // Official
    dept: String,
    deptLink: String,
    designation: String,
    designationLink: String,
    laptopPc: String,
    employeeCategory: { type: String, enum: ["Employee", "Consultant"] },
    employeesInCc: String,

    // Joining
    offerAcceptedDate: Date,
    plannedJoiningDate: Date,
    joiningStatus: {
      type: String,
      enum: ["Yet To Join Office", "Joined", "Not Joining"],
    },
    joinedDate: Date,
    notJoinedReason: String,

    // Salary
    salSerialNo: Number,
    salApplicableFrom: Date,
    basicSal: Number,
    hraSal: Number,
    travelAllowance: Number,
    childrenEducationAllowance: Number,
    supplementaryAllowance: Number,
    grossMonthly: Number,
    empEpf: Number,
    empEsic: Number,
    monthlyCtc: Number,
    medicalReimbursement: Number,
    vehicleReimbursement: Number,
    driverReimbursement: Number,
    telephoneReimbursement: Number,
    mealsReimbursement: Number,
    uniformReimbursement: Number,
    leaveTravelAllowance: Number,
    annualBonus: Number,
    annualPerformanceIncentive: Number,
    gratuity: Number,
    medicalPremium: Number,
    annualCtc: Number,

    // Contract
    contractPeriod: Number,
    contractAmount: Number,
    equivalentMonthlyCtc: Number,

    // Probation
    confirmationDueDate: Date,

    // Salary revision
    salReviewStatus: String,
    reasonForSalReview: String,
    salReviewType: String,
    salRevisionDueDate: Date,

    // Misc
    remarks: String,

    // Checklists
    checkLists: [CheckListSchema],

    // Scoring / calculated
    totalTasks: { type: Number, default: 0 },
    doneInTime: { type: Number, default: 0 },
    doneButDelayed: { type: Number, default: 0 },
    tasksOverdue: { type: Number, default: 0 },
    tasksDue: { type: Number, default: 0 },
    notYetDue: { type: Number, default: 0 },
    fmsScore: { type: Number, default: 0 },
    fmsStatus: { type: String, enum: ["Open", "Closed"], default: "Open" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Onboarding", OnboardingSchema);