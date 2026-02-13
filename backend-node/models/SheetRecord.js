const mongoose = require("mongoose");

const SheetRecordSchema = new mongoose.Schema(
  {
    sheetName: {
      type: String,
      required: true,
      index: true,
    },

    rowNumber: {
      type: Number,
      required: true,
      index: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

SheetRecordSchema.index(
  { sheetName: 1, rowNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("SheetRecord", SheetRecordSchema);