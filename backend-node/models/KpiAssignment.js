const mongoose = require("mongoose");

// Purely a dashboard label — "who currently owns this process" as a
// single, current fact per module. Not linked to individual records in
// Onboarding/Exit/HiringRequisition at all, and doesn't affect their
// schemas in any way. One document per module, upserted whenever changed.
const kpiAssignmentSchema = new mongoose.Schema(
  {
    module: { type: String, required: true, unique: true }, // "onboarding" | "exit" | "recruitment"
    dept: { type: String, default: "" },
    designation: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KpiAssignment", kpiAssignmentSchema);