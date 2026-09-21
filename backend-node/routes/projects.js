const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const Project = require('../models/Project');

const LEADS_API_URL = 'https://operations.briskolive.com/api/leads';

// operations.briskolive.com serves a self-signed cert (CN = its raw IP,
// not the domain), so default TLS verification always fails for it.
// Scoped to this one internal call only — not a global TLS override.
const leadsHttpsAgent = new https.Agent({ rejectUnauthorized: false });

// Fetch leads from Operations and upsert into the Project collection.
// product_or_service -> service, lead_title -> name
async function syncProjectsFromLeads() {
  const response = await axios.get(LEADS_API_URL, {
    timeout: 8000,
    httpsAgent: leadsHttpsAgent,
  });
  const leads = Array.isArray(response.data)
    ? response.data
    : response.data?.leads || response.data?.data || [];

  const ops = [];
  for (const lead of leads) {
    const service = lead.product_or_service?.trim();
    const name = lead.lead_title?.trim();

    if (!service || !name) continue;

    ops.push({
      updateOne: {
        filter: { service, name },
        update: { $setOnInsert: { service, name } },
        upsert: true,
      },
    });
  }

  // One round-trip for every lead instead of one per lead — this is what
  // was making /all feel slow (289 sequential upserts).
  if (ops.length) await Project.bulkWrite(ops, { ordered: false });

  return leads.length;
}

// GET all projects, grouped by service (used to populate cascading dropdowns)
// Syncs live from the Operations leads API on every call so the list is
// always current; falls back to whatever is already cached in Mongo if
// the leads API is unreachable.
router.get('/all', async (req, res) => {
  try {
    await syncProjectsFromLeads();
  } catch (err) {
    console.error('Live leads sync failed, serving cached projects:', err.message);
  }

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
