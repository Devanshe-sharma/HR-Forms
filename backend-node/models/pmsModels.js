// models/pmsModels.js
// IMPORTANT: explicit collection names required because Mongoose lowercases+pluralises
// by default: "DeptKPI" → "deptkpis" but DB has "deptKPIs"

const mongoose = require('mongoose');

function calculatePMSScore(achieved, target) {
  if (achieved >= target) return 0;
  const gap = target - achieved;
  if (gap < 100)   return -gap;
  if (gap < 1000)  return -(gap / 10);
  if (gap < 10000) return -(gap / 100);
  return -(gap / 1000);
}

// ── Dept KPI  →  collection: deptKPIs ────────────────────────────────────────
const DeptKPI = mongoose.model('DeptKPI', new mongoose.Schema({
  name:          { type: String, required: true },
  dept:          { type: String, required: true },   // field is 'dept' not 'department'
  targetValue:   { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  type:          { type: String, default: 'department' },
}, { timestamps: true, collection: 'deptKPIs' }));

// ── Dept Targets  →  collection: deptTargets ─────────────────────────────────
const DeptTargets = mongoose.model('DeptTargets', new mongoose.Schema({
  name:          { type: String, required: true },
  dept:          { type: String, required: true },   // field is 'dept' not 'department'
  targetValue:   { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  type:          { type: String, default: 'department' },
}, { timestamps: true, collection: 'deptTargets' }));

// ── Role KPI  →  collection: rolekpis ────────────────────────────────────────
const RoleKPI = mongoose.model('RoleKPI', new mongoose.Schema({
  name:          { type: String, required: true },
  role:          { type: String, required: true },
  employeeId:    { type: String },   // stored as string ObjectId e.g. "69744404a..."
  targetValue:   { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  type:          { type: String, default: 'role' },
}, { timestamps: true, collection: 'rolekpis' }));

// ── Role Targets  →  collection: roletargets ─────────────────────────────────
const RoleTargets = mongoose.model('RoleTargets', new mongoose.Schema({
  name:          { type: String, required: true },
  role:          { type: String, required: true },
  employeeId:    { type: String },   // stored as string ObjectId
  targetValue:   { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  type:          { type: String, default: 'role' },
}, { timestamps: true, collection: 'roletargets' }));

// ── Hygiene  →  collection: hygienes ─────────────────────────────────────────
const Hygiene = mongoose.model('Hygiene', new mongoose.Schema({
  employeeId:  { type: String, required: true },  // Employee._id as string
  attendance:  {
    present:    { type: Number, default: 0 },
    total:      { type: Number, default: 26 },
    percentage: { type: Number, default: 0 },
  },
  lateMarks:   { type: Number, default: 0 },
  leaves:      {
    taken:     { type: Number, default: 0 },
    allowed:   { type: Number, default: 12 },
    remaining: { type: Number, default: 12 },
  },
  outOfOffice: { type: Number, default: 0 },
  score:       { type: Number, default: 0 },
}, { timestamps: true, collection: 'hygienes' }));

// ── Growth  →  collection: growths ───────────────────────────────────────────
const Growth = mongoose.model('Growth', new mongoose.Schema({
  employeeId:            { type: String, required: true }, // Employee._id as string
  trainingDelivered:     { type: Number, default: 0 },
  trainingAttended:      { type: Number, default: 0 },
  investmentInitiatives: { type: Number, default: 0 },
  innovation: {
    ideasSubmitted:   { type: Number, default: 0 },
    ideasImplemented: { type: Number, default: 0 },
    score:            { type: Number, default: 0 },
  },
  score: { type: Number, default: 0 },
}, { timestamps: true, collection: 'growths' }));

// ── Startup log — confirms collection names on every server start ─────────────
console.log('✅ pmsModels loaded. Collections:',
  DeptKPI.collection.name,     // should print: deptKPIs
  DeptTargets.collection.name, // should print: deptTargets
  RoleKPI.collection.name,     // should print: rolekpis
  RoleTargets.collection.name, // should print: roletargets
  Hygiene.collection.name,     // should print: hygienes
  Growth.collection.name       // should print: growths
);

module.exports = { DeptKPI, DeptTargets, RoleKPI, RoleTargets, Hygiene, Growth, calculatePMSScore };