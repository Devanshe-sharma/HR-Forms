const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema(
  {
    service: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { collection: 'projects', timestamps: true }
);

ProjectSchema.index({ service: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Project', ProjectSchema);
