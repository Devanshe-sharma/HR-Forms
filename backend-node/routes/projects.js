const express = require('express');
const router = express.Router();
const Project = require('../models/Project');

// GET all projects, grouped by service (used to populate cascading dropdowns)
router.get('/all', async (req, res) => {
  try {
    const projects = await Project.find().sort({ service: 1, name: 1 });
    const services = [...new Set(projects.map((p) => p.service))];

    res.json({
      success: true,
      data: {
        services,
        projects: projects.map((p) => ({ service: p.service, name: p.name })),
      },
    });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
