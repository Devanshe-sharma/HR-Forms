const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const LinkSchema = new mongoose.Schema({
  id:   { type: String, default: () => uuidv4() },
  name: { type: String, default: '' },
  url:  { type: String, default: '' },
}, { _id: false });

const QuarterPPTSchema = new mongoose.Schema({
  id:      { type: String, default: () => uuidv4() },
  fy:      { type: String, required: true },   // ← was: year: Number
  quarter: { type: String, enum: ['Q1','Q2','Q3','Q4'], required: true },
  name:    { type: String, required: true },
  url:     { type: String, required: true },
}, { _id: false });

const RoleDocSchema = new mongoose.Schema({
  id:         { type: String, default: () => uuidv4() },
  role:       { type: String, required: true },
  jdUrl:      { type: String, default: '' },
  roleDocUrl: { type: String, default: '' },
}, { _id: false });

const NoteSchema = new mongoose.Schema({
  id:        { type: String, default: () => uuidv4() },
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  updatedAt: { type: String, default: () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
}, { _id: false });

const DepartmentSchema = new mongoose.Schema({
  id:              { type: String, default: () => uuidv4() },
  name:            { type: String, required: true, unique: true, trim: true },
  color:           { type: String, default: '#3B82F6' },
  onboardingPPT:   { type: LinkSchema, default: null },
  reviewPPTs:      { type: [QuarterPPTSchema], default: [] },
  masterPPT:       { type: LinkSchema, default: null },
  roleDocs:        { type: [RoleDocSchema], default: [] },
  notes:           { type: [NoteSchema], default: [] },
  recruitmentTest: { type: LinkSchema, default: null },
  onboardingTest:  { type: LinkSchema, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);