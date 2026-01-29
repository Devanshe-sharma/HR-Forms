const express = require('express');
const router = express.Router();
const TrainingProposal = require('../models/TrainingProposal');
const Employee = require('../models/Employee');

// GET all proposals - Supports nested filtering
router.get('/', async (req, res) => {
  try {
    const { status, isSuggestion } = req.query;
    const filter = {};
    if (status) filter['mgmt_info.status'] = status;
    if (isSuggestion !== undefined) filter['mgmt_info.isSuggestion'] = isSuggestion === 'true';

    const proposals = await TrainingProposal.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: proposals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST - Create new (HR or Mgmt)
router.post('/', async (req, res) => {
  try {
    const proposal = new TrainingProposal(req.body);
    await proposal.save();
    return res.status(201).json({ success: true, data: proposal });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH - General Update (Dot notation for nested fields)
router.patch('/:id', async (req, res) => {
  try {
    const updated = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, 
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH - Management Approval/Rejection
router.patch('/:id/mgmt-update', async (req, res) => {
  try {
    const { priority, status, reason } = req.body;
    const updated = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          "mgmt_info.priority": priority,
          "mgmt_info.status": status,
          "mgmt_info.reason": reason
        } 
      },
      { new: true }
    );
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH - Employee Feedback
router.patch('/:id/feedback', async (req, res) => {
  try {
    const feedbackData = req.body;
    const updated = await TrainingProposal.findByIdAndUpdate(
      req.params.id,
      { 
        $push: { feedback_info: feedbackData },
        $addToSet: { 
          "scorecard_info.attendees": { employeeName: feedbackData.employeeName, attended: true } 
        }
      },
      { new: true }
    );
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// PATCH - Finalize Scoring & Archive
router.patch('/:id/finalize-scores', async (req, res) => {
  try {
    const proposal = await TrainingProposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: 'Not found' });

    // Reward Trainer
    if (proposal.hr_info.trainerType === 'internal' && proposal.hr_info.trainerName) {
      await Employee.findOneAndUpdate(
        { full_name: proposal.hr_info.trainerName },
        { $inc: { score: 1 } }
      );
      proposal.scorecard_info.trainerScore = 1;
    }

    // Penalize No-Shows
    const allEmps = await Employee.find({});
    for (const emp of allEmps) {
      const record = proposal.scorecard_info.attendees.find(a => a.employeeName === emp.full_name);
      if (!record || !record.attended) {
        emp.score = (emp.score || 0) - 1;
        await emp.save();
      }
    }

    proposal.mgmt_info.status = 'Archived';
    proposal.scorecard_info.finalized = true;
    proposal.archivedAt = new Date();
    await proposal.save();

    return res.json({ success: true, message: 'Scores finalized' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- MIGRATION ROUTE: RUN ONCE TO FIX OLD FLAT DATA ---
router.get('/fix-old-data', async (req, res) => {
  try {
    const proposals = await TrainingProposal.find({});
    let count = 0;
    for (let p of proposals) {
      const flat = p.toObject();
      // If document is "flat" (has topic but no hr_info)
      if (flat.topic && !flat.hr_info) {
        p.set('hr_info', {
          topic: flat.topic,
          desc: flat.desc,
          trainerType: flat.trainerType,
          trainerName: flat.trainerName,
          trainerDept: flat.trainerDept,
          trainerDesig: flat.trainerDesig,
          external: flat.external
        });
        p.set('mgmt_info', {
          status: flat.status,
          priority: flat.priority,
          reason: flat.reason
        });
        // Remove old flat fields
        p.topic = undefined; p.desc = undefined; p.status = undefined; p.priority = undefined;
        await p.save();
        count++;
      }
    }
    return res.json({ success: true, message: `Migrated ${count} records.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;