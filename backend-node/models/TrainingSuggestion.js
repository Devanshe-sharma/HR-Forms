const mongoose = require('mongoose');
const { Schema } = mongoose;

const trainingSuggestionSchema = new Schema({
  capabilityId: { type: Schema.Types.ObjectId, ref: 'Capability', required: true },
  roleIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }], // single or multi based on trainingType
  departmentIds: { type: [String], default: [] }, // single or multi based on trainingType
  trainingType: { type: String, enum: ['Generic', 'Department', 'Level', 'MultiDept'], default: 'Department' },
  level: { type: Number, min: 1, max: 4, default: 1 },
  mandatory: { type: Boolean, default: false },
  scoreAchieved: { type: Number, min: 0, default: null }, // fetched from assessment
  topicSuggestions: { type: [String], default: [] },
  selectedTopics: { type: [String], default: [] }, // multi
  suggestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const TrainingSuggestion = mongoose.models.TrainingSuggestion || mongoose.model('TrainingSuggestion', trainingSuggestionSchema);
module.exports = TrainingSuggestion;
