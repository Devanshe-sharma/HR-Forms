const mongoose = require('mongoose');

const trainingScheduleSchema = new mongoose.Schema({
  trainingId:          { type: String, default: '' },
  trainingName:        { type: String, required: true, trim: true },
  capabilityArea:      { type: String, default: '' },
  capabilitySkill:     { type: String, default: '' },
  trainerName:         { type: String, default: '' },
  type:                { type: String, enum: ['Generic', 'Dept Specific', 'Level Specific', 'Role Specific'], default: 'Generic' },
  trainingDate:        { type: String, required: true },
  startTime:           { type: String, required: true },
  endTime:             { type: String, required: true },
  venue:               { type: String, default: '' },
  onlineLink:          { type: String, default: '' },
  targetAudience: {
    type:        { type: String, enum: ['all', 'departments', 'levels', 'roles'], default: 'all' },
    departments: [String],
    levels:      [Number],
    roles:       [String],
  },
  attendanceRequired:  { type: Boolean, default: true },
  maxAttempts:         { type: Number, default: 2 },
  feedbackWindow:      { type: Number, default: 5 },
  status:              { type: String, enum: ['Scheduled', 'Rescheduled', 'Cancelled', 'Completed'], default: 'Scheduled' },
  approvedBy:          { type: String, default: '' },
  approvedAt:          { type: Date },
  createdBy:           { type: String, default: 'System' },
}, { timestamps: true });

module.exports = mongoose.model('TrainingSchedule', trainingScheduleSchema);