const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingScheduleSchema = new Schema({
  trainingSuggestionId: { type: Schema.Types.ObjectId, ref: 'TrainingSuggestion', required: true },
  // selected topics for this schedule (multi)
  topics: { type: [String], default: [] },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  trainerId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  assignedEmployees: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
  approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

trainingScheduleSchema.index({ approvalStatus: 1 });
trainingScheduleSchema.index({ trainerId: 1 });
trainingScheduleSchema.index({ assignedEmployees: 1 });

const TrainingSchedule = mongoose.models.TrainingSchedule || mongoose.model('TrainingSchedule', trainingScheduleSchema);
module.exports = TrainingSchedule;
