const mongoose = require('mongoose');

// Singleton document: one row per role, each a map of pageKey -> visible.
// Missing keys are treated as visible (true) by the reading route.
const RbacPageVisibilitySchema = new mongoose.Schema(
  {
    Employee: { type: Object, default: {} },
    HR: { type: Object, default: {} },
    Manager: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RbacPageVisibility', RbacPageVisibilitySchema);
