const mongoose = require('mongoose');

const salaryRevisionSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employee_name: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  applicable_date: {
    type: Date,
    required: true
  },
  category: {
    type: String,
    enum: ['Employee', 'Consultant'],
    default: 'Employee'
  },
  decision: {
    type: String,
    enum: ['Increment', 'PIP'],
    required: true
  },
  manager_recommendation: {
    type: Number,
    default: 0
  },
  management_recommendation: {
    type: Number,
    default: 0
  },
  final_increment_percentage: {
    type: Number,
    default: 0
  },
  previous_ctc: {
    type: Number,
    required: true
  },
  new_ctc: {
    type: Number,
    required: true
  },
  pip_duration: {
    type: Number
  },
  pip_due_date: {
    type: Date
  },
  pip_reason: {
    type: String
  },
  pms_scores: {
    kpi_score: {
      type: Number,
      default: 0
    },
    hygiene_score: {
      type: Number,
      default: 0
    },
    growth_score: {
      type: Number,
      default: 0
    },
    total_score: {
      type: Number,
      default: 0
    }
  },
  salary_structure: {
    type: Map,
    of: Number
  },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  created_by: {
    type: String,
    required: true
  },
  updated_by: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SalaryRevision', salaryRevisionSchema);
