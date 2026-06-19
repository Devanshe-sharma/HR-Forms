const express           = require('express');
const router            = express.Router();
const HiringRequisition = require('../models/HiringRequisition');

// GET /api/hiringrequisitions/next-serial
router.get('/next-serial', async (req, res) => {
  try {
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    res.json({ success: true, next_serial: latest ? latest.serial_no + 1 : 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get next serial' });
  }
});

// GET /api/hiringrequisitions/open — public job postings
router.get('/open', async (req, res) => {
  try {
    const jobs = await HiringRequisition.find({ fmsStatus: 'Open' })
      .select('serial_no designation hiring_dept candidate_experience_level role_link jd_link createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch open positions' });
  }
});

// GET /api/hiringrequisitions/ — fetch all for dashboard (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status, dept, fmsStatus, search } = req.query;
    const filter = {};

    if (status)    filter.hiring_status = status;
    if (dept)      filter.hiring_dept   = dept;
    if (fmsStatus) filter.fmsStatus     = fmsStatus;
    if (search) {
      filter.$or = [
        { designation:          { $regex: search, $options: 'i' } },
        { requisitioner_name:   { $regex: search, $options: 'i' } },
        { hiring_dept:          { $regex: search, $options: 'i' } },
        { special_instructions: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await HiringRequisition.find(filter).sort({ serial_no: -1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch hiring requisitions' });
  }
});

// GET /api/hiringrequisitions/:id — single record
router.get('/:id', async (req, res) => {
  try {
    const doc = await HiringRequisition.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch record' });
  }
});

// POST /api/hiringrequisitions/ — create new requisition
router.post('/', async (req, res) => {
  try {
    // Re-derive serial at save time — not trusting form's earlier fetch
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    const serial_no = latest ? latest.serial_no + 1 : 1;

    const doc = await HiringRequisition.create({ ...req.body, serial_no });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('[hiringrequisitions POST]', err);
    res.status(500).json({ success: false, error: 'Failed to save requisition' });
  }
});

// PATCH /api/hiringrequisitions/:id — update any fields (dashboard edits)
router.patch('/:id', async (req, res) => {
  try {
    const { _id, __v, createdAt, updatedAt, serial_no, ...updates } = req.body;

    // Append a history entry
    const historyEntry = {
      note: `Status updated to "${updates.hiring_status || 'N/A'}" — ${updates.hr_remarks || ''}`,
      changedBy: updates.changedBy || 'HR',
      date: new Date(),
    };

    const doc = await HiringRequisition.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
        $push: { hiring_history: historyEntry },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('[hiringrequisitions PATCH]', err);
    res.status(500).json({ success: false, error: 'Failed to update requisition' });
  }
});

// PATCH /api/hiringrequisitions/:id/status — status-only update (quick action from table)
router.patch('/:id/status', async (req, res) => {
  try {
    const { hiring_status, fmsStatus } = req.body;
    const updates = {};
    if (hiring_status) updates.hiring_status = hiring_status;
    if (fmsStatus)     updates.fmsStatus     = fmsStatus;

    const doc = await HiringRequisition.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// PATCH /api/hiringrequisitions/:id/checklist — update a single checklist task
router.patch('/:id/checklist', async (req, res) => {
  try {
    const { task, ...taskUpdates } = req.body;
    if (!task) return res.status(400).json({ success: false, error: 'task name required' });

    const doc = await HiringRequisition.findOneAndUpdate(
      { _id: req.params.id, 'checklist_tasks.task': task },
      { $set: Object.fromEntries(
          Object.entries(taskUpdates).map(([k, v]) => [`checklist_tasks.$.${k}`, v])
        )
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Not found or task not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update checklist task' });
  }
});

// DELETE /api/hiringrequisitions/:id
router.delete('/:id', async (req, res) => {
  try {
    const doc = await HiringRequisition.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: `Requisition #${doc.serial_no} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete requisition' });
  }
});

module.exports = router;