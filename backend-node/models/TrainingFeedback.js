const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingFeedbackSchema = new Schema({
  trainingScheduleId: { type: Schema.Types.ObjectId, ref: 'TrainingSchedule', required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  rating: { type: Number, min: 1, max: 5 },
  comments: { type: String, trim: true, default: '' },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

trainingFeedbackSchema.index({ trainingScheduleId: 1, employeeId: 1 }, { unique: true });

const TrainingFeedback = mongoose.models.TrainingFeedback || mongoose.model('TrainingFeedback', trainingFeedbackSchema);
module.exports = TrainingFeedback;
