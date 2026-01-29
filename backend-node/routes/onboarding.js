const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const qs = require("querystring");


const spreadsheetId = "1pUlMGL05gnCr8Aqf-dWnzpXwTqYmW2oiONnFZw8L8qM";
const sheetName = "FMS";
function getAccessToken() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env variable not found");
  }

  const serviceAccount = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );

  const jwtToken = jwt.sign(
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: serviceAccount.token_uri,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    serviceAccount.private_key,
    { algorithm: "RS256" }
  );

  return axios.post(
    serviceAccount.token_uri,
    qs.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  ).then(res => res.data.access_token);
}


// GET all rows
router.get('/', async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    // Fetch all values
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:CZ1000`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ data: [] });
    }

    // First row is headers
    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Map rows into objects
    const data = dataRows.map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header.trim()] = row[idx] || "";
      });
      return obj;
    });

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update row by 'Ser'
router.put("/onboarding/:ser", async (req, res) => {
  try {
    const serToUpdate = req.params.ser;
    const updatedData = req.body; // expect full row as object

    const accessToken = await getAccessToken();

    // Fetch all rows to find row index of ser
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:CZ1000`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Sheet empty" });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Find row number where Ser matches
    const rowIndex = dataRows.findIndex((r) => r[0] == serToUpdate);
    if (rowIndex === -1) {
      return res.status(404).json({ error: `Row with Ser=${serToUpdate} not found` });
    }

    // Construct updated row array in correct order
    const updatedRow = headers.map((header) => updatedData[header.trim()] || "");

    // Row number in Sheets API is 1-based + 1 for header row
    const sheetRowNum = rowIndex + 2;

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A${sheetRowNum}:Z${sheetRowNum}?valueInputOption=USER_ENTERED`;

    await axios.put(
      updateUrl,
      {
        values: [updatedRow],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ success: true, message: "Row updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
        error: err.message,
        stack: err.stack,
      });

  }
});

module.exports = router;
