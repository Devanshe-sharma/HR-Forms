const mongoose = require('mongoose');
const { Schema } = mongoose;

const employeeScoreSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  trainingScheduleId: { type: Schema.Types.ObjectId, ref: 'TrainingSchedule', required: true },
  capabilityId: { type: Schema.Types.ObjectId, ref: 'Capability', default: null },
  scoreObtained: { type: Number, min: 0, required: true },
  maxScore: { type: Number, min: 0, required: true },
  percentage: { type: Number, min: 0, max: 100 },
  status: { type: String, enum: ['Pass', 'Fail'], required: true },
  evaluatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

employeeScoreSchema.index({ employeeId: 1, trainingScheduleId: 1 });

const EmployeeScore = mongoose.models.EmployeeScore || mongoose.model('EmployeeScore', employeeScoreSchema);
module.exports = EmployeeScore;
