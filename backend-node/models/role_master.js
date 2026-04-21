const mongoose = require('mongoose');

const ROLE_MASTER_COLLECTION = 'role_master';
const DEPARTMENT_TYPES = ['Delivery', 'Support'];

const RoleMasterSchema = new mongoose.Schema(
  {
    dept_id: {
      type: Number,  // Changed to Number to match your data (Dept_Id: 13, 7, 8, etc.)
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    dept_page_link: {
      type: String,
      trim: true,
      default: '',
    },
    dept_head_email: {
      type: String,
      trim: true,
      default: '',
    },
    dept_group_email: {
      type: String,
      trim: true,
      default: '',
    },
    parent_department: {
      type: String,
      trim: true,
      default: '',
    },
    department_type: {
      type: String,
      enum: [...DEPARTMENT_TYPES, ''],
      default: '',
    },
    department_head: {
      type: String,
      trim: true,
      default: '',
    },
    department_deputy: {
      type: String,
      trim: true,
      default: '',
    },
    desig_id: {
      type: Number,  // Changed to Number to match your data (Desig_id: 1301, 707, etc.)
      required: true,
      index: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    emp_id: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    emp_name: {
      type: String,
      trim: true,
      default: '',
    },
    role_document_link: {
      type: String,
      trim: true,
      default: '',
    },
    jd_link: {
      type: String,
      trim: true,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    management_level: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    reporting_manager: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    collection: ROLE_MASTER_COLLECTION,
    timestamps: true,
  }
);

// Compound unique index on dept_id and desig_id
RoleMasterSchema.index(
  { dept_id: 1, desig_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dept_id: { $exists: true, $ne: null },
      desig_id: { $exists: true, $ne: null },
    },
  }
);

// Additional indexes for common queries
RoleMasterSchema.index({ department: 1 });
RoleMasterSchema.index({ designation: 1 });
RoleMasterSchema.index({ emp_id: 1 }, { sparse: true });

module.exports = mongoose.model('RoleMaster', RoleMasterSchema);
module.exports.ROLE_MASTER_COLLECTION = ROLE_MASTER_COLLECTION;
module.exports.DEPARTMENT_TYPES = DEPARTMENT_TYPES;