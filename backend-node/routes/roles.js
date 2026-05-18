const express = require('express');
const router  = express.Router();

const { getRoles, getAllFormData } = require('../controllers/roleMasterController');

// GET /api/roles        — existing, unchanged
router.get('/', getRoles);

// GET /api/rolemaster/all  — new, for NewOnboarding.tsx dropdowns
router.get('/all', getAllFormData);

module.exports = router;