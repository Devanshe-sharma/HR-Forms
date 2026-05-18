const mongoose = require("mongoose");

// ============================================================
// CHECKLIST ITEM SCHEMA
// ============================================================

const checklistItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },

    planDate: {
      type: Date,
      default: null,
    },

    doneDate: {
      type: Date,
      default: null,
    },

    score: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      default: "Pending",
    },

    daysLeft: {
      type: Number,
      default: 0,
    },

    checked: {
      type: Boolean,
      default: false,
    },

    // column refs
    planCol: Number,
    doneCol: Number,
    scoreCol: Number,
    statusCol: Number,
    daysLeftCol: Number,
  },
  { _id: false }
);

// ============================================================
// CHECKLIST GROUP SCHEMA
// ============================================================

const checklistGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },

    planDate: {
      type: Date,
      default: null,
    },

    itemsList: {
      type: [checklistItemSchema],
      default: [],
    },
  },
  { _id: false }
);

// ============================================================
// MAIN ONBOARDING SCHEMA
// ============================================================

const onboardingSchema = new mongoose.Schema(
  {
    rowNo: Number,

    // ============================================================
    // SECTION 1: BASIC INFO (1-9)
    // ============================================================

    name: String,
    gender: String,
    persEmail: String,
    mobile: String,
    officialEmail: String,
    dept: String,
    designation: String,
    employeeCategory: String,
    nameOfBuddy: String,

    // ============================================================
    // SECTION 2: JOINING INFO (10-15)
    // ============================================================

    offerAcceptedDate: Date,
    plannedJoiningDate: Date,
    joiningStatus: String,
    exitStatus: String,
    joinedDate: Date,
    notJoinedReason: String,

    // ============================================================
    // SECTION 3: CONFIRMATION (16-23)
    // ============================================================

    confirmationStatus: String,
    confirmationSerialNo: String,
    reasonForNotApplicable: String,
    probationType: String,
    applicableFrom: Date,
    probationDuration: Number,
    confirmationDueDate: Date,
    confirmationHistory: String,

    // ============================================================
    // SECTION 4: REVIEWER (24-25)
    // ============================================================

    reviewerName: String,
    reviewerEmail: String,

    // ============================================================
    // SECTION 5: SALARY REVISION HEADER (26-28)
    // ============================================================

    salSerialNo: String,
    salType: String,
    salApplicableFrom: Date,

    // ============================================================
    // SECTION 6: SALARY STRUCTURE (29-52)
    // ============================================================

    annualCtc: Number,
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
    medicalPremium: Number,
    gratuity: Number,

    contractAmount: Number,
    contractPeriod: Number,
    equivalentMonthlyCtc: Number,

    // ============================================================
    // SECTION 7: NEXT SALARY REVIEW (53-56)
    // ============================================================

    salReviewStatus: String,
    salReviewType: String,
    reasonForSalReview: String,
    salRevisionDueDate: Date,

    // ============================================================
    // SECTION 8: EXIT FIELDS (57-63)
    // ============================================================

    resignationEmailSentOn: Date,
    noticePeriod: String,
    leftDate: Date,
    exitType: String,
    plannedExitDate: Date,
    knowledgeTransferTo: String,
    nextPerformanceReviewDate: Date,

    // ============================================================
    // SECTION 9: MISC (64-65)
    // ============================================================

    laptopPc: String,
    remarks: String,

    // ============================================================
    // SECTION 10: CALCULATED (66-75)
    // ============================================================

    totalTasks: {
      type: Number,
      default: 0,
    },

    doneInTime: {
      type: Number,
      default: 0,
    },

    doneButDelayed: {
      type: Number,
      default: 0,
    },

    tasksDue: {
      type: Number,
      default: 0,
    },

    tasksOverdue: {
      type: Number,
      default: 0,
    },

    notYetDue: {
      type: Number,
      default: 0,
    },

    fmsStatus: {
      type: String,
      default: "Open",
    },

    employeeStatus: String,

    employmentType: String,

    fmsScore: {
      type: Number,
      default: 0,
    },

    // ============================================================
    // SECTION 11: LINKS & CC (286-288)
    // ============================================================

    deptLink: String,
    designationLink: String,
    employeesInCc: {
  type: [String],
  default: [],
},

    // ============================================================
    // AUTO EMAILS
    // ============================================================

    autoWelcomeEmail: {
      type: Boolean,
      default: false,
    },

    autoReminderEmail: {
      type: Boolean,
      default: false,
    },

    autoInstructionsToAllEmail: {
      type: Boolean,
      default: false,
    },

    employeeConfirmationEmail: {
      type: Boolean,
      default: false,
    },

    // ============================================================
    // CHECKLISTS
    // ============================================================

    checkLists: {
      type: [checklistGroupSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model("Onboarding", onboardingSchema);