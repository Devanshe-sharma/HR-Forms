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

// link/attachment/systemName — matches what the frontend (DeptNotes in
// Deptorientationpage.tsx) actually sends. Neither is required since a
// note can carry just a link, just an attachment, or (in principle) both.
const NoteSchema = new mongoose.Schema({
  id:         { type: String, default: () => uuidv4() },
  link:       { type: String, default: '' },
  attachment: { type: String, default: '' },
  systemName: { type: String, default: '' },
  updatedAt:  { type: String, default: () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
}, { _id: false });

const DepartmentSchema = new mongoose.Schema({
  id:              { type: String, default: () => uuidv4() },
  name:            { type: String, required: true, unique: true, trim: true },
  department:      { type: String, default: '' },
  color:           { type: String, default: '#3B82F6' },
  // Google Drive folder structure: one root folder per department, with
  // subfolders per document category, created lazily on first upload
  // into that category (see ensureDeptFolder/ensureSubfolder in
  // routes/deptOrientationRoutes.js).
  driveFolderId:      { type: String, default: '' },
  notesFolderId:      { type: String, default: '' },
  roleDocsFolderId:   { type: String, default: '' },
  onboardingPPT:   { type: LinkSchema, default: null },
  reviewPPTs:      { type: [QuarterPPTSchema], default: [] },
  masterPPT:       { type: LinkSchema, default: null },
  roleDocs:        { type: [RoleDocSchema], default: [] },
  notes:           { type: [NoteSchema], default: [] },
  recruitmentTest: { type: LinkSchema, default: null },
  onboardingTest:  { type: LinkSchema, default: null },
}, { timestamps: true });

module.exports = mongoose.model('DepartmentOrientation', DepartmentSchema);