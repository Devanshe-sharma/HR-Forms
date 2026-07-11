const mongoose = require("mongoose");

// ============================================================
// INTERVIEW ROUND — internal only. No client/external interview
// concept, unlike the Recruitment department's candidate pipeline.
// ============================================================

const interviewRoundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    interviewerName: { type: String, default: "" },
    interviewDateTime: { type: Date, default: null },
    mode: { type: String, enum: ["", "Virtual", "In Person"], default: "" },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "Rescheduled"],
      default: "Scheduled",
    },
    result: {
      type: String,
      enum: ["", "Selected", "Rejected", "On Hold"],
      default: "",
    },
    feedback: { type: String, default: "" },
  },
  { _id: false }
);

// ============================================================
// HR CANDIDATE — one internal-hiring candidate against one open
// HR Requisition. Covers Application -> Screening -> Interviews ->
// Offer & Acceptance. Deliberately stops there: once an offer is
// accepted, the actual employee record and everything after
// (checklists, salary structure, etc.) belongs to Onboarding,
// which is already a complete, separate module — this schema
// does not duplicate any of that.
// ============================================================

const hrCandidateSchema = new mongoose.Schema(
  {
    requisitionId: { type: mongoose.Schema.Types.ObjectId, ref: "HrRequisition", required: true },

    // Snapshotted at application time so the candidate record still makes
    // sense even if the requisition's own department/designation changes
    // later.
    department: { type: String, default: "" },
    designation: { type: String, default: "" },

    name: { type: String, required: true, trim: true },
    contact: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    resume: { type: String, default: "" }, // link/URL
    source: { type: String, default: "" }, // e.g. Referral, Naukri, LinkedIn
    referenceName: { type: String, default: "" },
    appliedDate: { type: Date, default: Date.now },

    currentCTC: { type: Number, default: null },
    expectedCTC: { type: Number, default: null },
    noticePeriod: { type: String, default: "" },

    // ── Screening ──────────────────────────────────────────────────────────
    screenerName: { type: String, default: "" },
    screenerNotes: { type: String, default: "" },
    screenerStatus: {
      type: String,
      enum: ["", "Shortlisted", "Rejected", "On Hold"],
      default: "",
    },

    // ── Interviews ─────────────────────────────────────────────────────────
    interviewRounds: { type: [interviewRoundSchema], default: [] },

    // ── Offer & Acceptance ─────────────────────────────────────────────────
    offerExtended: { type: Boolean, default: false },
    offeredCTC: { type: Number, default: null },
    offerExtendedDate: { type: Date, default: null },
    offerAcceptedDate: { type: Date, default: null },
    tentativeJoiningDate: { type: Date, default: null },

    // ── Overall pipeline status ────────────────────────────────────────────
    finalStatus: {
      type: String,
      enum: [
        "Applied",
        "Screening",
        "Shortlisted",
        "Interviewing",
        "Offer Extended",
        "Offer Accepted",
        "Ready for Onboarding",
        "Rejected",
        "Not Joined",
        "On Hold",
      ],
      default: "Applied",
    },

    // Set once an Onboarding record has actually been created for this
    // candidate — a simple marker so this pipeline knows the handoff
    // happened, without needing to duplicate anything Onboarding tracks.
    onboardingCreated: { type: Boolean, default: false },
    onboardingId: { type: mongoose.Schema.Types.ObjectId, ref: "Onboarding", default: null },

    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

hrCandidateSchema.index({ requisitionId: 1 });
hrCandidateSchema.index({ finalStatus: 1 });

module.exports = mongoose.model("HrCandidate", hrCandidateSchema);