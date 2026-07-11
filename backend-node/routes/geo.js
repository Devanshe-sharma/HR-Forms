// routes/geo.js
// ─────────────────────────────────────────────────────────────────────────────
// Mount in app.js:  app.use('/api/geo', require('./routes/geo'));
//
// Uses the "country-state-city" npm package — a maintained, offline
// dataset (no external API calls, no rate limits, no network flakiness).
// This replaces whatever the previous implementation was doing, since the
// symptom reported (wrong state's cities always showing, e.g. Uttar
// Pradesh appearing regardless of the selected state) is exactly what
// happens when a /cities route either ignores its `state` query param or
// has a hardcoded/broken fallback — the frontend was already sending the
// state name correctly (confirmed from CandidateApplicationPage.tsx), so
// the bug lives in whatever the old backend route did with it.
//
// Install once: npm install country-state-city
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { Country, State, City } = require('country-state-city');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/geo/countries
// Used by the frontend for the phone dial-code picker: { name, dialCode }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/countries', (req, res) => {
  try {
    const countries = Country.getAllCountries()
      .filter((c) => c.phonecode) // skip anything with no dial code
      .map((c) => ({
        name: c.name,
        dialCode: c.phonecode.startsWith('+') ? c.phonecode : `+${c.phonecode}`,
      }));
    res.json(countries);
  } catch (err) {
    console.error('[geo/countries] error:', err);
    res.status(500).json({ success: false, message: 'Failed to load countries' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/geo/states?country=IN
// Defaults to India (IN) since that's this app's only supported country
// for state/city selection today. Returns { name } to match what the
// frontend expects, plus isoCode so the /cities route below can be called
// unambiguously even if two states ever shared a display name.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/states', (req, res) => {
  try {
    const countryCode = (req.query.country || 'IN').toUpperCase();
    const states = State.getStatesOfCountry(countryCode).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
    }));
    res.json(states);
  } catch (err) {
    console.error('[geo/states] error:', err);
    res.status(500).json({ success: false, message: 'Failed to load states' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/geo/cities?state=<state name or isoCode>&country=IN
// This is the route that was returning wrong results. Matches the state
// param against BOTH its isoCode and its display name (case-insensitive),
// since the frontend currently sends the state's name (e.g. "Uttar
// Pradesh") — matching by name only would silently break if two states
// ever had the same name in different countries, so isoCode is checked
// first as the more precise match.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cities', (req, res) => {
  try {
    const { state, country } = req.query;
    if (!state) return res.json([]);

    const countryCode = (country || 'IN').toUpperCase();
    const allStates = State.getStatesOfCountry(countryCode);

    const matched =
      allStates.find((s) => s.isoCode === state) ||
      allStates.find((s) => s.name.toLowerCase() === String(state).trim().toLowerCase());

    if (!matched) {
      console.warn(`[geo/cities] No state match for "${state}" in ${countryCode}`);
      return res.json([]);
    }

    const cities = City.getCitiesOfState(countryCode, matched.isoCode).map((c) => ({
      name: c.name,
    }));
    res.json(cities);
  } catch (err) {
    console.error('[geo/cities] error:', err);
    res.status(500).json({ success: false, message: 'Failed to load cities' });
  }
});

module.exports = router;