const express = require("express");
const router = express.Router();
const Requisition = require("../models/requisition");

// GET all
router.get("/", async (req, res) => {
  const data = await Requisition.find().sort({ createdAt: -1 });
  res.json({ data });
});

// UPDATE by ID
router.put("/:id", async (req, res) => {
  const updated = await Requisition.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json({ success: true, data: updated });
});

module.exports = router;