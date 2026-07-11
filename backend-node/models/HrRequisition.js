const mongoose = require("mongoose");

// ============================================================
// HR REQUISITION — an open position HR is hiring for internally.
// Deliberately separate from the Recruitment department's own
// requisition system, which tracks positions being filled FOR
// external clients. This one has no client fields at all.
// ============================================================

const hrRequisitionSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    numberOfOpenings: { type: Number, default: 1, min: 1 },

    priority: {
      type: String,
      enum: ["P1", "P2", "P3", "NA"],
      default: "NA",
    },

    requestedBy: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Open", "On Hold", "Closed"],
      default: "Open",
    },

    openedDate: { type: Date, default: Date.now },
    closedDate: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

hrRequisitionSchema.index({ status: 1 });

module.exports = mongoose.model("HrRequisition", hrRequisitionSchema);