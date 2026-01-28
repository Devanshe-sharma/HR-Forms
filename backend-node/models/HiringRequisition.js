const mongoose = require('mongoose');

const HiringRequisitionSchema = new mongoose.Schema({
  ser: { type: String, unique: true },

  // Requester Details
  request_date: String,
  requisitioner_name: String,
  requisitioner_email: String,

  // Position to Hire
  hiring_dept: String,
  hiring_dept_email: String,
  dept_group_email: String,

  // Designation Logic
  designation_type: String, // existing | new
  designation_existing: String,
  designation_new: String,
  designation: String, // computed

  role_link: String,
  jd_link: String,

  // Days & Hiring Plan
  select_joining_days: String,
  plan_start_sharing_cvs: String,
  planned_interviews_started: String,
  planned_offer_accepted: String,
  planned_joined: String,

  // Additional Info
  special_instructions: String,
  hiring_status: String,

  // CC Emails
  employees_in_cc: [String],

  // Checklist
  role_n_jd_exist: String,
  role_n_jd_read: String,
  role_n_jd_good: String,
  days_well_thought: String,

  // Timestamps
  created_at: String,
  updated_at: String,
}, {
  collection: 'hiring_requisitions'
});

module.exports = mongoose.model(
  'HiringRequisition',
  HiringRequisitionSchema
);
