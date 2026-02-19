// routes/training.js  —  mounted at /api/trainings

const express = require('express');
const router = express.Router();
const Training = require('../models/Training');
const Employee = require('../models/Employee');

// Async wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const normalizeTrainingType = (t) => {
  if (!t) return undefined;
  const v = String(t).trim();
  // allow nicer labels from UI
  if (v === 'Department specific' || v === 'Department Specific') return 'Dept Specific';
  if (v === 'Level specific' || v === 'Level Specific') return 'Level Specific';
  if (v === 'Multi department' || v === 'Multi Department') return 'Multi Dept';
  return v;
};

// ─────────────────────────────────────────────────────────────
// GET ALL
// ─────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const trainings = await Training.find().sort({ createdAt: -1 });
  res.json({ success: true, data: trainings });
}));

// ─────────────────────────────────────────────────────────────
// CREATE PHASE 1 (HR → capability assignment + topic suggestion)
// ─────────────────────────────────────────────────────────────
router.post('/phase1', asyncHandler(async (req, res) => {
  const {
    departments = [],
    designation = '',
    category = '',
    trainingType,
    level = null,
    capabilities = [],
    topicSuggestions = [],
    selectedTopic = '',
  } = req.body || {};

  const normalizedType = normalizeTrainingType(trainingType) || 'Dept Specific';

  if (normalizedType !== 'Generic' && (!Array.isArray(departments) || departments.length === 0)) {
    return res.status(400).json({ success: false, error: 'Please select department(s)' });
  }
  if (normalizedType !== 'Generic' && !String(designation).trim()) {
    return res.status(400).json({ success: false, error: 'Please select designation' });
  }
  if (normalizedType === 'Level Specific' && ![1, 2, 3].includes(Number(level))) {
    return res.status(400).json({ success: false, error: 'Please select level 1, 2, or 3' });
  }
  if (!String(selectedTopic).trim()) {
    return res.status(400).json({ success: false, error: 'Please select/provide a training topic' });
  }

  const training = await Training.create({
    phase1: {
      departments: Array.isArray(departments) ? departments : [],
      designation: String(designation || '').trim(),
      category: String(category || '').trim(),
      trainingType: normalizedType,
      level: normalizedType === 'Level Specific' ? Number(level) : null,
      capabilities: Array.isArray(capabilities) ? capabilities : [],
      topicSuggestions: Array.isArray(topicSuggestions) ? topicSuggestions : [],
      selectedTopic: String(selectedTopic || '').trim(),
    },
    approval: { status: 'Pending' },
    workflowStatus: 'Proposed',
  });

  res.status(201).json({ success: true, data: training });
}));

// Backward-compatible alias (older UI used /schedule)
router.post('/schedule', asyncHandler(async (req, res) => {
  req.url = '/phase1';
  return router.handle(req, res);
}));

// ─────────────────────────────────────────────────────────────
// CREATE/UPDATE PHASE 2 (HR → training details by training_id)
// ─────────────────────────────────────────────────────────────
router.post('/:id/phase2', asyncHandler(async (req, res) => {
  const training = await Training.findById(req.params.id);
  if (!training) return res.status(404).json({ success: false, error: 'Training not found' });

  const {
    trainingTopic = '',
    description = '',
    priority = 'P3',
    trainerType = 'Internal Trainer',
    internalTrainer = null,
    externalTrainer = null,
    status = 'Draft',
    contentPdfLink = '',
    videoLink = '',
    assessmentLink = '',
  } = req.body || {};

  if (!String(trainingTopic).trim()) {
    return res.status(400).json({ success: false, error: 'Training topic is required' });
  }
  if (!String(description).trim()) {
    return res.status(400).json({ success: false, error: 'Description is required' });
  }
  if (!['P1', 'P2', 'P3'].includes(priority)) {
    return res.status(400).json({ success: false, error: 'Invalid priority' });
  }
  if (!['Internal Trainer', 'External Consultant'].includes(trainerType)) {
    return res.status(400).json({ success: false, error: 'Invalid trainer type' });
  }

  // Resolve internal trainer (denormalization)
  let resolvedInternal = training.phase2?.internalTrainer || {};
  let resolvedExternal = training.phase2?.externalTrainer || {};

  if (trainerType === 'Internal Trainer') {
    const employeeId = internalTrainer?.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Please select internal trainer' });
    }
    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return res.status(400).json({ success: false, error: 'Invalid internal trainer' });
    resolvedInternal = {
      employeeId: String(emp._id),
      name: emp.full_name || '',
      department: emp.department || '',
      designation: emp.designation || '',
    };
    resolvedExternal = {
      source: '',
      trainerName: '',
      organisation: '',
      mobile: '',
      email: '',
    };
  } else {
    if (!externalTrainer?.trainerName) {
      return res.status(400).json({ success: false, error: 'External trainer name is required' });
    }
    resolvedExternal = {
      source: externalTrainer?.source || '',
      trainerName: externalTrainer?.trainerName || '',
      organisation: externalTrainer?.organisation || '',
      mobile: externalTrainer?.mobile || '',
      email: externalTrainer?.email || '',
    };
    resolvedInternal = {
      employeeId: '',
      name: '',
      department: '',
      designation: '',
    };
  }

  training.phase2 = {
    ...training.phase2?.toObject?.(),
    trainingTopic: String(trainingTopic).trim(),
    type: training.phase1?.trainingType || training.phase2?.type || 'Dept Specific',
    capabilitiesCovered: training.phase1?.capabilities || training.phase2?.capabilitiesCovered || [],
    description: String(description).trim(),
    priority,
    trainerType,
    internalTrainer: resolvedInternal,
    externalTrainer: resolvedExternal,
    status: String(status || 'Draft').trim(),
    contentPdfLink: String(contentPdfLink || '').trim(),
    videoLink: String(videoLink || '').trim(),
    assessmentLink: String(assessmentLink || '').trim(),
  };

  await training.save();
  res.json({ success: true, data: training });
}));

// ─────────────────────────────────────────────────────────────
// UPDATE (Edit / Schedule Date)
// ─────────────────────────────────────────────────────────────
router.patch('/:id', asyncHandler(async (req, res) => {

  const training = await Training.findById(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  const {
    phase1,
    phase2,
    scheduledDate
  } = req.body;

  if (phase1) {
    const normalizedType = normalizeTrainingType(phase1.trainingType) || training.phase1?.trainingType;
    training.phase1 = {
      ...training.phase1?.toObject?.(),
      ...phase1,
      trainingType: normalizedType,
    };
    if (normalizedType !== 'Level Specific') training.phase1.level = null;
  }
  if (phase2) {
    training.phase2 = {
      ...training.phase2?.toObject?.(),
      ...phase2,
    };
  }

  // Only allow scheduling if Approved
  if (scheduledDate) {
    if (training.workflowStatus !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: 'Training must be Approved before scheduling'
      });
    }

    training.scheduledDate = new Date(scheduledDate);
    training.workflowStatus = 'Scheduled';
  }

  await training.save();

  res.json({ success: true, data: training });
}));

// ─────────────────────────────────────────────────────────────
// FEEDBACK (Phase 3)
// ─────────────────────────────────────────────────────────────
router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const training = await Training.findById(req.params.id);
  if (!training) return res.status(404).json({ success: false, error: 'Training not found' });

  const {
    name,
    department,
    level,
    overallRating,
    contentQuality,
    missing = '',
    helpful = '',
  } = req.body || {};

  if (!name) return res.status(400).json({ success: false, error: 'Your name is required' });
  if (!overallRating) return res.status(400).json({ success: false, error: 'Overall rating is required' });
  if (!contentQuality) return res.status(400).json({ success: false, error: 'Content quality rating is required' });

  training.feedback = training.feedback || [];
  training.feedback.push({
    participant: String(name),
    rating: Number(overallRating),
    comments: String(helpful || ''),
    attendeeName: String(name),
    department: String(department || ''),
    level: String(level || ''),
    overallRating: Number(overallRating),
    contentQuality: Number(contentQuality),
    missing: String(missing || ''),
    helpful: String(helpful || ''),
  });

  await training.save();
  res.json({ success: true, data: training });
}));

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const training = await Training.findByIdAndDelete(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  res.json({ success: true });
}));


// ─────────────────────────────────────────────────────────────
// APPROVE (Management)
// ─────────────────────────────────────────────────────────────
router.post('/:id/approve', asyncHandler(async (req, res) => {

  const training = await Training.findById(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  if (training.workflowStatus !== 'Proposed') {
    return res.status(400).json({
      success: false,
      error: 'Training is not pending approval'
    });
  }

  training.approval = {
    status: 'Approved',
    remarks: req.body.remarks || '',
    approvedBy: 'Management',
    approvedAt: new Date()
  };

  training.workflowStatus = 'Approved';

  await training.save();

  res.json({ success: true, data: training });
}));


// ─────────────────────────────────────────────────────────────
// REJECT (Management)
// ─────────────────────────────────────────────────────────────
router.post('/:id/reject', asyncHandler(async (req, res) => {

  const training = await Training.findById(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  if (!req.body.remarks) {
    return res.status(400).json({
      success: false,
      error: 'Remarks required for rejection'
    });
  }

  training.approval = {
    status: 'Rejected',
    remarks: req.body.remarks,
    approvedBy: 'Management',
    approvedAt: new Date()
  };

  training.workflowStatus = 'Rejected';

  await training.save();

  res.json({ success: true, data: training });
}));


// ─────────────────────────────────────────────────────────────
// ARCHIVE (Management)
// ─────────────────────────────────────────────────────────────
router.post('/:id/archive', asyncHandler(async (req, res) => {
  const training = await Training.findById(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  training.workflowStatus = 'Archived';
  await training.save();

  res.json({ success: true, data: training });
}));


// ─────────────────────────────────────────────────────────────
// GET BY ID
// ─────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const training = await Training.findById(req.params.id);
  if (!training)
    return res.status(404).json({ success: false, error: 'Training not found' });

  res.json({ success: true, data: training });
}));


// ─────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  console.error('❌ Training route error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors)
        .map(e => e.message)
        .join(', ')
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

module.exports = router;