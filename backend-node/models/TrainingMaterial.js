const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingMaterialSchema = new Schema({
  trainingScheduleId: { type: Schema.Types.ObjectId, ref: 'TrainingSchedule', required: true },
  contentFile: { type: String, trim: true, default: '' }, // pdf/doc link or path
  videoUrl: { type: String, trim: true, default: '' },
  assessmentId: { type: Schema.Types.ObjectId, ref: 'CapabilityAssessment', default: null }, // from pool
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

trainingMaterialSchema.index({ trainingScheduleId: 1 });

const TrainingMaterial = mongoose.models.TrainingMaterial || mongoose.model('TrainingMaterial', trainingMaterialSchema);
module.exports = TrainingMaterial;
