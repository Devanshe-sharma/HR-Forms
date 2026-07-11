const express = require("express");
const HrRequisition = require("../models/HrRequisition");
const HrCandidate = require("../models/HrCandidate");

const router = express.Router();

// ════════════════════════════════════════════════════════════
// REQUISITIONS
// ════════════════════════════════════════════════════════════

router.get("/requisitions", async (req, res) => {
  try {
    const docs = await HrRequisition.find().sort({ status: 1, createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/requisitions", async (req, res) => {
  try {
    const doc = await HrRequisition.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/requisitions/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    // Closing a requisition stamps the date automatically, the same way
    // Onboarding's own one-time fields work — not something the person
    // needs to remember to set by hand.
    if (body.status === "Closed") {
      const existing = await HrRequisition.findById(req.params.id);
      if (existing && existing.status !== "Closed") {
        body.closedDate = new Date();
      }
    }
    const doc = await HrRequisition.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/requisitions/:id", async (req, res) => {
  try {
    const candidateCount = await HrCandidate.countDocuments({ requisitionId: req.params.id });
    if (candidateCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${candidateCount} candidate(s) are linked to this requisition.`,
      });
    }
    await HrRequisition.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// CANDIDATES
// ════════════════════════════════════════════════════════════

router.get("/candidates", async (req, res) => {
  try {
    const filter = {};
    if (req.query.requisitionId) filter.requisitionId = req.query.requisitionId;
    const docs = await HrCandidate.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/candidates/:id", async (req, res) => {
  try {
    const doc = await HrCandidate.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/candidates", async (req, res) => {
  try {
    const body = { ...req.body };

    // Snapshot department/designation from the requisition at application
    // time, same reasoning as Salary Revision snapshotting employee
    // fields — stays sensible even if the requisition changes later.
    if (body.requisitionId) {
      const req_ = await HrRequisition.findById(body.requisitionId);
      if (req_) {
        body.department = req_.department;
        body.designation = req_.designation;
      }
    }

    const doc = await HrCandidate.create(body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/candidates/:id", async (req, res) => {
  try {
    const doc = await HrCandidate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/candidates/:id", async (req, res) => {
  try {
    await HrCandidate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Screening ────────────────────────────────────────────────────────────
router.put("/candidates/:id/screening", async (req, res) => {
  try {
    const { screenerName, screenerNotes, screenerStatus } = req.body;
    const existing = await HrCandidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    const setFields = { screenerName, screenerNotes, screenerStatus };

    // Screening result drives overall status forward — mirrors the same
    // status-propagation pattern the Recruitment department's own
    // candidate page already uses (roundState -> finalStatus), just with
    // this pipeline's own simpler stage names.
    if (screenerStatus === "Shortlisted") setFields.finalStatus = "Shortlisted";
    else if (screenerStatus === "Rejected") setFields.finalStatus = "Rejected";
    else if (screenerStatus === "On Hold") setFields.finalStatus = "On Hold";
    else setFields.finalStatus = "Screening";

    const doc = await HrCandidate.findByIdAndUpdate(req.params.id, setFields, { new: true });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Interview rounds ─────────────────────────────────────────────────────
router.post("/candidates/:id/interview-round", async (req, res) => {
  try {
    const existing = await HrCandidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    const nextRoundNumber = (existing.interviewRounds?.length || 0) + 1;
    const round = { ...req.body, roundNumber: req.body.roundNumber || nextRoundNumber };

    existing.interviewRounds.push(round);

    // First round scheduled moves the pipeline into "Interviewing", unless
    // it's already further along (offer stage) or already rejected.
    if (!["Offer Extended", "Offer Accepted", "Ready for Onboarding", "Rejected", "Not Joined"].includes(existing.finalStatus)) {
      existing.finalStatus = "Interviewing";
    }

    await existing.save();
    res.json({ success: true, data: existing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk update — same "whole array replace" approach as the Recruitment
// candidate page's own internal-rounds save, since rounds are edited
// inline and saved together rather than one field at a time.
router.put("/candidates/:id/interview-rounds", async (req, res) => {
  try {
    const { interviewRounds } = req.body;
    const existing = await HrCandidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    existing.interviewRounds = interviewRounds || [];

    // If any round was marked Rejected, that takes priority over
    // everything else.
    const anyRejected = existing.interviewRounds.some((r) => r.result === "Rejected");
    if (anyRejected) existing.finalStatus = "Rejected";

    await existing.save();
    res.json({ success: true, data: existing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Offer & acceptance ───────────────────────────────────────────────────
router.put("/candidates/:id/offer", async (req, res) => {
  try {
    const {
      offerExtended, offeredCTC, offerExtendedDate,
      offerAcceptedDate, tentativeJoiningDate,
    } = req.body;

    const setFields = {
      offerExtended, offeredCTC, offerExtendedDate,
      offerAcceptedDate, tentativeJoiningDate,
    };

    if (offerAcceptedDate) setFields.finalStatus = "Offer Accepted";
    else if (offerExtended) setFields.finalStatus = "Offer Extended";

    const doc = await HrCandidate.findByIdAndUpdate(req.params.id, setFields, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Marks the handoff to Onboarding as done — call this once you've
// actually created the Onboarding record for this person, so this
// pipeline doesn't keep showing them as still in progress. Does not
// create the Onboarding record itself — that's a deliberate separate
// step using the existing Onboarding module, not duplicated here.
router.put("/candidates/:id/mark-onboarding-created", async (req, res) => {
  try {
    const { onboardingId } = req.body;
    const doc = await HrCandidate.findByIdAndUpdate(
      req.params.id,
      { onboardingCreated: true, onboardingId: onboardingId || null, finalStatus: "Ready for Onboarding" },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;