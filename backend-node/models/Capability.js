const mongoose = require('mongoose');
const { Schema } = mongoose;

const capabilitySchema = new Schema({
  capabilityName: { type: String, trim: true, required: true },
  capabilityDescription: { type: String, trim: true, default: '' },
  isGeneric: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

capabilitySchema.index({ capabilityName: 1 });

const Capability = mongoose.models.Capability || mongoose.model('Capability', capabilitySchema);
module.exports = Capability;
