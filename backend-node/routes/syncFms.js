const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const qs = require("querystring");

const SheetRecord = require("../models/SheetRecord");
const Requisition = require("../models/Requisition");

const spreadsheetId = "1pUlMGL05gnCr8Aqf-dWnzpXwTqYmW2oiONnFZw8L8qM";
const sheetName = "FMS";

async function getAccessToken() {
  const jwtToken = jwt.sign(
    {
      iss: process.env.GOOGLE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    { algorithm: "RS256" }
  );

  const res = await axios.post(
    "https://oauth2.googleapis.com/token",
    qs.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return res.data.access_token;
}

router.post("/fms", async (req, res) => {
  const token = await getAccessToken();

  const sheetRes = await axios.get(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const [headers, ...rows] = sheetRes.data.values;

  for (let i = 0; i < rows.length; i++) {
    const rowData = {};
    headers.forEach((h, idx) => (rowData[h] = rows[i][idx] || ""));

    // 1️⃣ Save raw
    await SheetRecord.updateOne(
      { sheetName, rowNumber: i + 2 },
      { sheetName, rowNumber: i + 2, data: rowData },
      { upsert: true }
    );

    // 2️⃣ Map to app model
    await Requisition.updateOne(
      { officialEmail: rowData["Official Email"] },
      {
        $set: {
          name: rowData.Name,
          gender: rowData.Gender,
          personalEmail: rowData["Personal Email"],
          officialEmail: rowData["Official Email"],
          mobile: rowData.Mobile,
          dept: rowData.Dept,
          designation: rowData.Designation,
          joiningStatus: rowData["Joining Status"],
          exitStatus: rowData["Exit Status"],
          sheetRowNumber: i + 2,
        },
      },
      { upsert: true }
    );
  }

  res.json({ success: true });
});

module.exports = router;