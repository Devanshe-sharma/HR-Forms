const mongoose = require('mongoose');

// Employee Schema
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  designation: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Department KPI Schema
const deptKPISchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: String, required: true },
  targetValue: { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  type: { type: String, enum: ['department'], default: 'department' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Role KPI Schema
const roleKPISchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  employeeId: { type: String, required: true },
  targetValue: { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  type: { type: String, enum: ['role'], default: 'role' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Department Targets Schema
const deptTargetsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: String, required: true },
  targetValue: { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  type: { type: String, enum: ['department'], default: 'department' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Role Targets Schema
const roleTargetsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  employeeId: { type: String, required: true },
  targetValue: { type: Number, required: true },
  achievedValue: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  type: { type: String, enum: ['role'], default: 'role' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hygiene Factors Schema
const hygieneSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, ref: 'Employee' },
  attendance: {
    present: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true }
  },
  lateMarks: { type: Number, default: 0 },
  leaves: {
    taken: { type: Number, default: 0 },
    allowed: { type: Number, required: true },
    remaining: { type: Number, required: true }
  },
  outOfOffice: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Growth Data Schema
const growthSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, ref: 'Employee' },
  trainingDelivered: { type: Number, default: 0 },
  trainingAttended: { type: Number, default: 0 },
  investmentInitiatives: { type: Number, default: 0 },
  innovation: {
    ideasSubmitted: { type: Number, default: 0 },
    ideasImplemented: { type: Number, default: 0 },
    score: { type: Number, default: 0 }
  },
  score: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// All pre-save middleware removed - handled in routes

module.exports = {
  Employee: mongoose.models.Employee || mongoose.model('Employee', employeeSchema),
  DeptKPI: mongoose.models.DeptKPI || mongoose.model('DeptKPI', deptKPISchema),
  RoleKPI: mongoose.models.RoleKPI || mongoose.model('RoleKPI', roleKPISchema),
  DeptTargets: mongoose.models.DeptTargets || mongoose.model('DeptTargets', deptTargetsSchema),
  RoleTargets: mongoose.models.RoleTargets || mongoose.model('RoleTargets', roleTargetsSchema),
  Hygiene: mongoose.models.Hygiene || mongoose.model('Hygiene', hygieneSchema),
  Growth: mongoose.models.Growth || mongoose.model('Growth', growthSchema)
};
