// routes/geo.js
const express = require('express');
const router  = express.Router();

// In-memory cache so we don't hammer external APIs on every request
const cache = {};

async function cached(key, fetcher) {
  if (cache[key]) return cache[key];
  const data = await fetcher();
  cache[key] = data;
  return data;
}

// GET /api/geo/countries
router.get('/countries', async (req, res) => {
  try {
    const data = await cached('countries', async () => {
      const r = await fetch('https://restcountries.com/v3.1/all?fields=name,idd');
      const raw = await r.json();
      return raw
        .filter((c) => c.idd?.root)
        .map((c) => ({
          name:     c.name.common,
          dialCode: c.idd.root + (c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : ''),
        }))
        .filter((c) => c.dialCode)
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/geo/states
router.get('/states', async (req, res) => {
  try {
    const data = await cached('states', async () => {
      const r = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ country: 'India' }),
      });
      const json = await r.json();
      return (json?.data?.states ?? [])
        .map((s) => ({ name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch states' });
  }
});

// GET /api/geo/cities?state=Maharashtra
router.get('/cities', async (req, res) => {
  const { state } = req.query;
  if (!state) return res.status(400).json({ error: 'state param required' });

  try {
    const data = await cached(`cities_${state}`, async () => {
      const r = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ country: 'India', state }),
      });
      const json = await r.json();
      return (json?.data ?? [])
        .map((name) => ({ name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch cities' });
  }
});

module.exports = router;