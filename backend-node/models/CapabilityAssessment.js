const mongoose = require('mongoose');
const { Schema } = mongoose;

const capabilityAssessmentSchema = new Schema({
  capabilityId: { type: Schema.Types.ObjectId, ref: 'Capability', required: true },
  // role_id: picked from employee master list (store employee _id as string)
  roleId: { type: String, trim: true, required: true },

  // auto-filled from employee master / department master
  departmentId: { type: String, trim: true, required: true }, // department name (from Employee.department)
  departmentHead: { type: String, trim: true, default: '' }, // dept head (email/name)

  // 1 Management, 2 Dept head, 3 Department manager, 4 Executive
  managementLevel: { type: Number, enum: [1, 2, 3, 4], default: null },

  requiredScore: { type: Number, min: 0, required: true },
  maximumScore: { type: Number, min: 0, required: true },

  scoreAchieved: { type: Number, min: 0, default: null },

  mandatory: { type: Boolean, default: false },
  assessmentLink: { type: String, trim: true, default: '' },
  trainingMandatoryAfterTest: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

capabilityAssessmentSchema.index({ capabilityId: 1, roleId: 1, departmentId: 1 }, { unique: false });

const CapabilityAssessment = mongoose.models.CapabilityAssessment || mongoose.model('CapabilityAssessment', capabilityAssessmentSchema);
module.exports = CapabilityAssessment;
