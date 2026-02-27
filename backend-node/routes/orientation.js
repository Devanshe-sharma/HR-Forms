const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Orientation = require('../models/Orientation');
const { protect, requireRole } = require('../middleware/auth');

// ── Helper: get or create the single orientation doc ──────────────────────────
async function getDoc() {
  let doc = await Orientation.findOne();
  if (!doc) doc = await Orientation.create({});
  return doc;
}

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/orientation          — ALL roles: fetch entire orientation data
// ════════════════════════════════════════════════════════════════════════════════
router.get('/', protect, async (req, res) => {
  try {
    const doc = await getDoc();
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PUT /api/orientation/ppt      — HR only: update onboarding PPT link
// Body: { name, url }
// ════════════════════════════════════════════════════════════════════════════════
router.put('/ppt', protect, requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const doc = await getDoc();
    doc.onboardingPPT = { name: name || doc.onboardingPPT.name, url, updatedBy: req.user.name || req.user.id };
    await doc.save();

    res.json({ success: true, data: doc.onboardingPPT });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// PUT /api/orientation/test     — HR only: update onboarding test link
// Body: { name, url }
// ════════════════════════════════════════════════════════════════════════════════
router.put('/test', protect, requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const doc = await getDoc();
    doc.onboardingTest = { name: name || doc.onboardingTest.name, url, updatedBy: req.user.name || req.user.id };
    await doc.save();

    res.json({ success: true, data: doc.onboardingTest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// POLICIES
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/orientation/policies   — HR only: add a policy link
// Body: { name, url }
router.post('/policies', protect, requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, message: 'Name and URL required' });

    const doc = await getDoc();
    const newPolicy = { id: uuidv4(), name, url, uploadedBy: req.user.name || req.user.id, updatedAt: new Date() };
    doc.policies.push(newPolicy);
    await doc.save();

    res.status(201).json({ success: true, data: newPolicy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/policies/:id  — HR only: update a policy link
// Body: { name, url }
router.put('/policies/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    const policy = doc.policies.find(p => p.id === req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found' });

    if (req.body.name) policy.name = req.body.name;
    if (req.body.url)  policy.url  = req.body.url;
    policy.uploadedBy = req.user.name || req.user.id;
    policy.updatedAt  = new Date();
    await doc.save();

    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orientation/policies/:id — HR only
router.delete('/policies/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    doc.policies = doc.policies.filter(p => p.id !== req.params.id);
    await doc.save();
    res.json({ success: true, message: 'Policy removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// TAX FORMS
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/orientation/tax-forms  — HR only: add a form link
// Body: { name, url }
router.post('/tax-forms', protect, requireRole('hr'), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, message: 'Name and URL required' });

    const doc = await getDoc();
    const newForm = { id: uuidv4(), name, url, uploadedBy: req.user.name || req.user.id, updatedAt: new Date() };
    doc.taxForms.push(newForm);
    await doc.save();

    res.status(201).json({ success: true, data: newForm });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/tax-forms/:id — HR only
router.put('/tax-forms/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    const form = doc.taxForms.find(f => f.id === req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });

    if (req.body.name) form.name = req.body.name;
    if (req.body.url)  form.url  = req.body.url;
    form.uploadedBy = req.user.name || req.user.id;
    form.updatedAt  = new Date();
    await doc.save();

    res.json({ success: true, data: form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orientation/tax-forms/:id — HR only
router.delete('/tax-forms/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    doc.taxForms = doc.taxForms.filter(f => f.id !== req.params.id);
    await doc.save();
    res.json({ success: true, message: 'Form removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// HOLIDAYS
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/orientation/holidays — HR or management
// Body: { name, date, type }
router.post('/holidays', protect, requireRole('hr', 'management'), async (req, res) => {
  try {
    const { name, date, type } = req.body;
    if (!name || !date) return res.status(400).json({ success: false, message: 'Name and date required' });

    const doc = await getDoc();
    const newHoliday = { id: uuidv4(), name, date, type: type || 'national' };
    doc.holidays.push(newHoliday);
    await doc.save();

    res.status(201).json({ success: true, data: newHoliday });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orientation/holidays/:id — HR only
router.delete('/holidays/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    doc.holidays = doc.holidays.filter(h => h.id !== req.params.id);
    await doc.save();
    res.json({ success: true, message: 'Holiday removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// WEEK OFFS
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/orientation/weekoffs — HR or management
router.post('/weekoffs', protect, requireRole('hr', 'management'), async (req, res) => {
  try {
    const { label, days } = req.body;
    if (!label || !days) return res.status(400).json({ success: false, message: 'Label and days required' });

    const doc = await getDoc();
    const newWeekoff = { id: uuidv4(), label, days };
    doc.weekoffs.push(newWeekoff);
    await doc.save();

    res.status(201).json({ success: true, data: newWeekoff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/weekoffs/:id — HR or management
router.put('/weekoffs/:id', protect, requireRole('hr', 'management'), async (req, res) => {
  try {
    const doc = await getDoc();
    const weekoff = doc.weekoffs.find(w => w.id === req.params.id);
    if (!weekoff) return res.status(404).json({ success: false, message: 'Week off not found' });

    if (req.body.label) weekoff.label = req.body.label;
    if (req.body.days)  weekoff.days  = req.body.days;
    await doc.save();

    res.json({ success: true, data: weekoff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/orientation/weekoffs/:id — HR only
router.delete('/weekoffs/:id', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    doc.weekoffs = doc.weekoffs.filter(w => w.id !== req.params.id);
    await doc.save();
    res.json({ success: true, message: 'Week off removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// INSURANCE
// ════════════════════════════════════════════════════════════════════════════════

// PUT /api/orientation/insurance/policy — HR only: save Google Drive link to policy PDF
// Body: { url, name, coverageAmount, coverageType }
router.put('/insurance/policy', protect, requireRole('hr'), async (req, res) => {
  try {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const doc = await getDoc();
    doc.insurance.policyUrl  = url;
    if (name) doc.insurance.policyName = name;
    doc.insurance.updatedBy = req.user.name || req.user.id;
    await doc.save();

    res.json({ success: true, data: doc.insurance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/insurance/claim-form — HR only
// Body: { url, name }
router.put('/insurance/claim-form', protect, requireRole('hr'), async (req, res) => {
  try {
    const { url, name } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

    const doc = await getDoc();
    doc.insurance.claimFormUrl  = url;
    if (name) doc.insurance.claimFormName = name;
    doc.insurance.updatedBy = req.user.name || req.user.id;
    await doc.save();

    res.json({ success: true, data: doc.insurance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/insurance/steps — HR only
// Body: { eCardSteps: string[], claimSteps: string[] }
router.put('/insurance/steps', protect, requireRole('hr'), async (req, res) => {
  try {
    const doc = await getDoc();
    if (req.body.eCardSteps) doc.insurance.eCardSteps = req.body.eCardSteps;
    if (req.body.claimSteps) doc.insurance.claimSteps = req.body.claimSteps;
    doc.insurance.updatedBy = req.user.name || req.user.id;
    await doc.save();

    res.json({ success: true, data: doc.insurance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orientation/insurance/contact — HR only
// Body: { name, phone, email }
router.put('/insurance/contact', protect, requireRole('hr'), async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const doc = await getDoc();
    doc.insurance.representative = { name: name || '', phone: phone || '', email: email || '' };
    doc.insurance.updatedBy = req.user.name || req.user.id;
    await doc.save();

    res.json({ success: true, data: doc.insurance.representative });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;