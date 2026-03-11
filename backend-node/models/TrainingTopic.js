const mongoose = require('mongoose');

const trainingTopicSchema = new mongoose.Schema({
  trainingId:           { type: String, required: true, unique: true },
  trainingName:         { type: String, required: true, trim: true },
  trainerName:          { type: String, required: true, trim: true },
  capabilityArea:       { type: String, required: true },
  capabilitySkill:      { type: String, required: true },
  type:                 { type: String, enum: ['Generic', 'Dept Specific', 'Level Specific', 'Role Specific'], required: true },
  isGeneric:            { type: Boolean, default: false },
  proposedScheduleDate: { type: String, required: true },
  contentPdfLink:       { type: String, default: '' },
  videoLink:            { type: String, default: '' },
  assessmentLink:       { type: String, default: '' },
  status:               { type: String, enum: ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Sent Back'], default: 'Draft' },
  managementRemark:     { type: String, default: '' },
  approvedBy:           { type: String, default: '' },
  approvedAt:           { type: Date },
  createdBy:            { type: String, default: 'System' },
}, { timestamps: true });

module.exports = mongoose.model('TrainingTopic', trainingTopicSchema);