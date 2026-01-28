const mongoose = require('mongoose');

const CtcComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
      // Examples: BASIC, HRA, CONVEYANCE, PF, ESIC, ANNUAL_BONUS, GRATUITY, etc.
    },

    formula: {
      type: String,
      trim: true,
      default: '', // e.g. "basic + hra" or "basic * 0.4" – optional for future calculation engine
    },

    order: {
      type: Number,
      required: true,
      min: 0,
      default: 999, // higher = appears lower in list
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    show_in_documents: {
      type: Boolean,
      default: true, // whether to show this component in offer letter, salary slip, etc.
    },

    category: {
      type: String,
      enum: ['Earning', 'Deduction', 'Contribution', 'Reimbursement', 'Bonus', 'Other'],
      default: 'Earning',
    },

    is_annual: {
      type: Boolean,
      default: false, // true = value is yearly (bonus, gratuity, LTA), false = monthly
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    created_at: {
      type: Date,
      default: Date.now,
    },

    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'ctc_components',
    timestamps: true, // auto-updates updated_at
  }
);

// Optional: auto-update updated_at on save
CtcComponentSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('CtcComponent', CtcComponentSchema);