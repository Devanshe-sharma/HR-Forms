// models/TrainingAttempt.js — assessment attempts (max 2 per employee per training)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingAttemptSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  trainingId: { type: Schema.Types.ObjectId, ref: 'Training', required: true },
  attemptNo: { type: Number, required: true, min: 1, max: 2 },
  scoreAchieved: { type: Number, required: true, min: 0, max: 100 },
  requiredScore: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, enum: ['Pass', 'Fail'], required: true },
  attemptedAt: { type: Date, default: Date.now },
}, { timestamps: true });

trainingAttemptSchema.index({ employeeId: 1, trainingId: 1, attemptNo: 1 }, { unique: true });

const TrainingAttempt = mongoose.models.TrainingAttempt || mongoose.model('TrainingAttempt', trainingAttemptSchema);
module.exports = TrainingAttempt;
