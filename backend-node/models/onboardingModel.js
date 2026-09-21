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
      enum: ["", "Employee", "Consultant", "Intern", "Intern with PPO", "Contract Based", "Part Time", "Temporary Staffing"],
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
          contractStartDate: { type: Date,   default: null },
          contractEndDate:   { type: Date,   default: null },
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

    // Drops by 1 each time an escalation names this employee (see
    // backend-node/routes/escalations.js) — a running conduct tally,
    // separate from fmsScore's task-completion tracking.
    escalationScore: {
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
    // Shown on the Employees page "Personal Info" tab (Admin/Management/HR)
    // AND editable by the employee themselves from their own Profile page
    // (self-service — see routes/onboardingroutes.js PUT /:id/personal-info).
    // This is the single source of truth for this data: the employee's own
    // edits land here directly, so the Employees page always reflects
    // exactly what the employee last saved — no separate copy to sync.
    // ============================================================

    // Citizenship
    citizenship: { type: String, default: "" },
    nationality: { type: String, default: "" },
    passportNo: { type: String, default: "" },
    passportValidUpto: { type: Date, default: null },
    passportIssuePlace: { type: String, default: "" },

    // Address (self-service)
    address: { type: String, default: "" },

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

    // Family details. familySiblings/familyChildren (free text) are legacy —
    // kept so old data isn't lost, but the Profile page's Family form now
    // uses familySiblingsList (a real add/remove list) and
    // familyNumberOfChildren (a count) instead.
    familyFather: { type: String, default: "" },
    familyFatherOccupation: { type: String, default: "" },
    familyMother: { type: String, default: "" },
    familyMotherOccupation: { type: String, default: "" },
    familySiblings: { type: String, default: "" },
    familySiblingsList: {
      type: [{ name: { type: String, default: "" }, occupation: { type: String, default: "" } }],
      default: [],
    },
    familySpouse: { type: String, default: "" },
    familySpouseOccupation: { type: String, default: "" },
    familyChildren: { type: String, default: "" },
    familyNumberOfChildren: { type: Number, default: null },

    // Self-uploaded documents (Profile page, Personal/Employment Documents
    // tabs) — one entry per successful upload, keyed by docType (see
    // utils/onboardingDocumentTypes.js). Files live in Google Drive, not on
    // local disk; only the resulting link is stored here.
    documents: {
      type: [{
        docType:    { type: String, default: "" },
        fileName:   { type: String, default: "" },
        driveLink:  { type: String, default: "" },
        uploadedAt: { type: Date,   default: null },
      }],
      default: [],
    },
    documentsUploadFolderId: { type: String, default: null },
    documentsUploadFolderLink: { type: String, default: null },

    // Digital signature — a single current image, replaced (not appended)
    // on re-upload. Shown on the Employee List and generated letters.
    signature: {
      fileName:    { type: String, default: "" },
      driveLink:   { type: String, default: "" },
      driveFileId: { type: String, default: "" },
      uploadedAt:  { type: Date,   default: null },
    },

    // Company assets issued on/around joining — a simple received-it
    // checklist the employee ticks off themselves from their Profile page.
    companyAssets: {
      dateIssued: { type: Date, default: null },
      laptop:     { type: Boolean, default: false },
      mouse:      { type: Boolean, default: false },
      charger:    { type: Boolean, default: false },
      simCard:    { type: Boolean, default: false },
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