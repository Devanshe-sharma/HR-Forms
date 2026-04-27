const mongoose = require('mongoose');

const ROLE_MASTER_COLLECTION = 'role_master';
const DEPARTMENT_TYPES = ['Delivery', 'Support'];

const RoleMasterSchema = new mongoose.Schema(
  {
    dept_id: {
      type: Number,
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
      type: Number,
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
    desig_email_id: {
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

// ── Indexes ──────────────────────────────────────────────────────────────────

// Compound unique: one row per dept + designation combination
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

RoleMasterSchema.index({ department: 1 });
RoleMasterSchema.index({ designation: 1 });
RoleMasterSchema.index({ emp_id: 1 },         { sparse: true });
RoleMasterSchema.index({ desig_email_id: 1 }, { sparse: true });
RoleMasterSchema.index({ parent_department: 1 });
RoleMasterSchema.index({ management_level: 1 });

// ── Virtual: PascalCase aliases (mirrors what the controller exposes) ────────
// These let you do roleMasterDoc.Department, .Designation, etc. in server code.

RoleMasterSchema.virtual('Dept_Id').get(function () { return this.dept_id; });
RoleMasterSchema.virtual('Department').get(function () { return this.department; });
RoleMasterSchema.virtual('Dept_Page_Link').get(function () { return this.dept_page_link; });
RoleMasterSchema.virtual('Dept_Head_Email').get(function () { return this.dept_head_email; });
RoleMasterSchema.virtual('Dept_Group_Email').get(function () { return this.dept_group_email; });
RoleMasterSchema.virtual('Parent_Department').get(function () { return this.parent_department; });
RoleMasterSchema.virtual('Department_Type').get(function () { return this.department_type; });
RoleMasterSchema.virtual('Department_Head').get(function () { return this.department_head; });
RoleMasterSchema.virtual('Department_Deputy').get(function () { return this.department_deputy; });
RoleMasterSchema.virtual('Desig_id').get(function () { return this.desig_id; });
RoleMasterSchema.virtual('Designation').get(function () { return this.designation; });
RoleMasterSchema.virtual('Emp_Id').get(function () { return this.emp_id; });
RoleMasterSchema.virtual('Emp_Name').get(function () { return this.emp_name; });
RoleMasterSchema.virtual('Desig_Email_Id').get(function () { return this.desig_email_id; });
RoleMasterSchema.virtual('Role_Document_Link').get(function () { return this.role_document_link; });
RoleMasterSchema.virtual('JD_Link').get(function () { return this.jd_link; });
RoleMasterSchema.virtual('Remarks').get(function () { return this.remarks; });
RoleMasterSchema.virtual('Management_Level').get(function () { return this.management_level; });
RoleMasterSchema.virtual('Reporting_Manager').get(function () { return this.reporting_manager; });

// ── Static helpers ────────────────────────────────────────────────────────────

/**
 * Returns all unique departments sorted alphabetically.
 * @returns {Promise<Array<{ dept_id: number, department: string }>>}
 */
RoleMasterSchema.statics.getUniqueDepartments = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$dept_id',
        dept_id:    { $first: '$dept_id' },
        department: { $first: '$department' },
      },
    },
    { $sort: { department: 1 } },
    { $project: { _id: 0, dept_id: 1, department: 1 } },
  ]);
};

/**
 * Returns unique designations, optionally scoped to a department.
 * @param {string} [department]
 * @returns {Promise<Array<{ desig_id: number, designation: string }>>}
 */
RoleMasterSchema.statics.getUniqueDesignations = function (department) {
  const pipeline = [];
  if (department) {
    pipeline.push({ $match: { department: { $regex: new RegExp(`^${department}$`, 'i') } } });
  }
  pipeline.push(
    {
      $group: {
        _id: '$desig_id',
        desig_id:    { $first: '$desig_id' },
        designation: { $first: '$designation' },
      },
    },
    { $sort: { designation: 1 } },
    { $project: { _id: 0, desig_id: 1, designation: 1 } }
  );
  return this.aggregate(pipeline);
};

/**
 * Find the role entry matching a department + designation pair.
 * Used by employee enrichment in the controller.
 * @param {string} department
 * @param {string} designation
 */
RoleMasterSchema.statics.findByDeptAndDesig = function (department, designation) {
  return this.findOne({
    department: { $regex: new RegExp(`^${department}$`, 'i') },
    designation: { $regex: new RegExp(`^${designation}$`, 'i') },
  }).lean();
};

// ── Exports ───────────────────────────────────────────────────────────────────

const RoleMaster = mongoose.model('RoleMaster', RoleMasterSchema);

module.exports = RoleMaster;
module.exports.ROLE_MASTER_COLLECTION = ROLE_MASTER_COLLECTION;
module.exports.DEPARTMENT_TYPES = DEPARTMENT_TYPES;