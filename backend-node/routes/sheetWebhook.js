const express = require("express");
const router = express.Router();
const SheetRecord = require("../models/SheetRecord");
const Requisition = require("../models/Requisition");

router.post("/sheet-sync", async (req, res) => {
  const { sheet, rowNumber, rowData } = req.body;

  await SheetRecord.updateOne(
    { sheetName: sheet, rowNumber },
    { sheetName: sheet, rowNumber, data: rowData },
    { upsert: true }
  );

  await Requisition.updateOne(
    { officialEmail: rowData["Official Email"] },
    {
      $set: {
        name: rowData.Name,
        gender: rowData.Gender,
        officialEmail: rowData["Official Email"],
        dept: rowData.Dept,
        joiningStatus: rowData["Joining Status"],
        exitStatus: rowData["Exit Status"],
        sheetRowNumber: rowNumber,
      },
    },
    { upsert: true }
  );

  res.json({ success: true });
});

module.exports = router;