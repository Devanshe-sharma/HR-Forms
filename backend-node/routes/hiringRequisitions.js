const express          = require('express');
const router           = express.Router();
const HiringRequisition = require('../models/HiringRequisition');

// GET /api/hiringrequisitions/next-serial
// Looks at the highest serial_no already saved and adds 1.
router.get('/next-serial', async (req, res) => {
  try {
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    const next = latest ? latest.serial_no + 1 : 1;
    res.json({ success: true, next_serial: next });
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

// GET /api/hiringrequisitions/ — fetch all for dashboard
router.get('/', async (req, res) => {
  try {
    const data = await HiringRequisition.find({}).sort({ createdAt: -1 });
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch hiring requisitions' });
  }
});

// POST /api/hiringrequisitions/ — save new requisition from form
router.post('/', async (req, res) => {
  try {
    // Re-check the latest serial right at save time, not trusting whatever
    // the form fetched earlier — covers the case where someone else submitted
    // in between this user opening the form and clicking submit.
    const latest = await HiringRequisition.findOne({})
      .sort({ serial_no: -1 })
      .select('serial_no')
      .lean();
    const serial_no = latest ? latest.serial_no + 1 : 1;

    const newRequisition = new HiringRequisition({
      ...req.body,
      serial_no,
    });
    await newRequisition.save();

    res.status(201).json({
      message: 'Hiring requisition saved successfully!',
      data: newRequisition,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save hiring requisition' });
  }
});

module.exports = router;