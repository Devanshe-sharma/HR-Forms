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

// Pre-save middleware to calculate scores
deptKPISchema.pre('save', function(next) {
  if (this.targetValue > 0) {
    this.score = (this.achievedValue / this.targetValue) * 100;
  }
  next();
});

roleKPISchema.pre('save', function(next) {
  if (this.targetValue > 0) {
    this.score = (this.achievedValue / this.targetValue) * 100;
  }
  next();
});

deptTargetsSchema.pre('save', function(next) {
  if (this.targetValue > 0) {
    this.score = (this.achievedValue / this.targetValue) * 100;
  }
  next();
});

roleTargetsSchema.pre('save', function(next) {
  if (this.targetValue > 0) {
    this.score = (this.achievedValue / this.targetValue) * 100;
  }
  next();
});

hygieneSchema.pre('save', function(next) {
  // Calculate hygiene score based on multiple factors
  const attendanceScore = this.attendance.percentage;
  const lateScore = Math.max(0, 100 - (this.lateMarks * 10)); // 10 points per late mark
  const leaveScore = (this.leaves.remaining / this.leaves.allowed) * 100;
  this.score = (attendanceScore * 0.4) + (lateScore * 0.3) + (leaveScore * 0.3);
  next();
});

growthSchema.pre('save', function(next) {
  // Calculate growth score
  const trainingScore = Math.min(100, (this.trainingAttended / 40) * 100); // 40 hours target
  const investmentScore = Math.min(100, (this.investmentInitiatives / 5) * 100); // 5 initiatives target
  const innovationScore = this.innovation.score;
  this.score = (trainingScore * 0.4) + (investmentScore * 0.3) + (innovationScore * 0.3);
  next();
});

module.exports = {
  Employee: mongoose.models.Employee || mongoose.model('Employee', employeeSchema),
  DeptKPI: mongoose.models.DeptKPI || mongoose.model('DeptKPI', deptKPISchema),
  RoleKPI: mongoose.models.RoleKPI || mongoose.model('RoleKPI', roleKPISchema),
  DeptTargets: mongoose.models.DeptTargets || mongoose.model('DeptTargets', deptTargetsSchema),
  RoleTargets: mongoose.models.RoleTargets || mongoose.model('RoleTargets', roleTargetsSchema),
  Hygiene: mongoose.models.Hygiene || mongoose.model('Hygiene', hygieneSchema),
  Growth: mongoose.models.Growth || mongoose.model('Growth', growthSchema)
};
