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
    // NOTE: "" is included in the enum list because default: "" applies
    // to every record that's never had this field explicitly set — if ""
    // isn't itself a valid enum value, Mongoose fails validation against
    // its OWN default the moment .save() runs on any such record. This
    // exact bug previously blocked saving unrelated fields on records
    // with no employeeCategory/managementLevel set yet.
    employeeCategory: {
      type: String,
      enum: ["", "Employee", "Consultant", "Intern", "Contract Based", "Part Time", "Temporary Staffing"],
      default: "",
    },
    managementLevel: {
      type: String,
      enum: [
        "",
        "Office Staff",
        "Junior Management",
        "Middle Management",
        "Senior Management",
        "Apex Management (C Level)",
      ],
      default: "",
    },
    nameOfBuddy: String,
    empId: { type: String, default: "" },

    // ============================================================
    dept_id:  { type: Number, default: null },
    desig_id: { type: Number, default: null },


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
    contractStartDate: Date,
    contractEndDate: Date,
    // Full renewal history — every past contract period, oldest first.
    // contractStartDate/contractEndDate above always mirror the LAST
    // entry here (the current/latest period); endDate is null for a
    // period that's ongoing with no end date decided yet.
    // Contract history — one entry per update
      contractHistory: [
        {
          contractPeriod:    { type: String, default: '' },
          contractAmount:    { type: String, default: '' },
          salApplicableFrom: { type: String, default: '' },
          equivalentMonthlyCtc: { type: String, default: '' },
          updatedAt:         { type: Date,   default: Date.now },
          updatedBy:         { type: String, default: '' },
          remarks:           { type: String, default: '' },
        }
      ],
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
    // Additive field — supports Salary Revision syncing reporting-head
    // changes back onto the onboarding record. Purely optional, defaults
    // to empty so existing documents are unaffected.
    reportingHead: { type: String, default: "" },

    // ── REFERRAL (confidential, same convention as Exit's Asked-to-Leave
    // fields) — referredPerformance/referredReason are HR-internal notes
    // on how a referral turned out. Never referenced by any email
    // template, and never included in an aggregate dashboard stat's
    // per-employee/per-department breakdown — only an overall percentage.
    referred: { type: Boolean, default: false },
    // Who referred this joinee — used by the Confirmations flow to check
    // referral-bonus eligibility on confirmation. Unlike referredPerformance/
    // referredReason above, this pair IS read by an email template.
    referredByName: { type: String, default: "" },
    referredByEmail: { type: String, default: "" },
    referredPerformance: { type: String, default: "" },
    referredReason: { type: String, default: "" },

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
    // These are one-time sends. The boolean tells the UI/automation
    // whether it has EVER been sent. The paired *SentAt timestamp is
    // the source of truth: once set, it is never cleared or
    // overwritten by a later update, and the checkbox stays "Done".
    // ============================================================

    autoWelcomeEmail: {
      type: Boolean,
      default: false,
    },
    autoWelcomeEmailSentAt: {
      type: Date,
      default: null,
    },

    autoReminderEmail: {
      type: Boolean,
      default: false,
    },
    autoReminderEmailSentAt: {
      type: Date,
      default: null,
    },

    autoInstructionsToAllEmail: {
      type: Boolean,
      default: false,
    },
    autoInstructionsToAllEmailSentAt: {
      type: Date,
      default: null,
    },

    employeeConfirmationEmail: {
      type: Boolean,
      default: false,
    },
    employeeConfirmationEmailSentAt: {
      type: Date,
      default: null,
    },

    // ============================================================
    // CHECKLISTS
    // ============================================================

    checkLists: {
      type: [checklistGroupSchema],
      default: [],
    },

    // ============================================================
    // SECTION 12: PUBLIC PROFILE EXTRAS
    // Shown on the Employees page "Public Info" tab alongside dept/
    // designation/reporting head, which already exist above.
    // ============================================================

    companyName: { type: String, default: "" },
    jobLocation: { type: String, default: "" },

    // ============================================================
    // SECTION 13: PERSONAL INFO
    // Shown only to Admin / Management / HR on the Employees page
    // "Personal Info" tab. Not editable yet — populated later via a
    // dedicated form; fields default blank ("Not provided" in the UI).
    // ============================================================

    // Citizenship
    citizenship: { type: String, default: "" },
    nationality: { type: String, default: "" },
    passportNo: { type: String, default: "" },
    passportValidUpto: { type: Date, default: null },
    passportIssuePlace: { type: String, default: "" },

    // Bank details
    bankName: { type: String, default: "" },
    bankAccountNo: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    panCard: { type: String, default: "" },
    aadhaarNo: { type: String, default: "" },
    uanNo: { type: String, default: "" },
    ePassbookLink: { type: String, default: "" },

    // Contact details — name/phone/personal email already exist as
    // name/mobile/persEmail above; these are the fields unique to this tab.
    birthday: { type: Date, default: null },
    bloodGroup: { type: String, default: "" },
    maritalStatus: { type: String, default: "" },

    // Emergency contact
    emergencyContactName: { type: String, default: "" },
    emergencyContactRelation: { type: String, default: "" },
    emergencyContactPhone: { type: String, default: "" },
    emergencyContactPlace: { type: String, default: "" },

    // Family details
    familyFather: { type: String, default: "" },
    familyMother: { type: String, default: "" },
    familySiblings: { type: String, default: "" },
    familySpouse: { type: String, default: "" },
    familyChildren: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model("Onboarding", onboardingSchema);