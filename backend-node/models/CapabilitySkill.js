const mongoose = require('mongoose');

const capabilitySkillSchema = new mongoose.Schema({
  capabilityId:    { type: String, required: true },
  capabilitySkill: { type: String, required: true, trim: true },
  isGeneric:       { type: Boolean, default: false },
  capabilityArea:  { type: String, default: '' },
  createdBy:       { type: String, default: 'System' },
}, { timestamps: true });

module.exports = mongoose.model('CapabilitySkill', capabilitySkillSchema);