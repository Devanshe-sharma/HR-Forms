const mongoose = require('mongoose');

const capabilityAreaSchema = new mongoose.Schema({
  capabilityAreaId: { type: String, required: true, unique: true },
  capabilityArea:   { type: String, required: true, trim: true },
  createdBy:        { type: String, default: 'System' },
}, { timestamps: true });

module.exports = mongoose.model('CapabilityArea', capabilityAreaSchema);