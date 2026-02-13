const mongoose = require("mongoose");

const RequisitionSchema = new mongoose.Schema(
  {
    name: String,
    gender: String,
    personalEmail: String,
    officialEmail: { type: String, index: true },
    mobile: String,
    dept: String,
    designation: String,
    joiningStatus: String,
    exitStatus: String,
    sheetRowNumber: Number,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Requisition ||
  mongoose.model("Requisition", RequisitionSchema);