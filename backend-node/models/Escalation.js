const mongoose = require('mongoose');

// An array so the schema stays extensible, but "BO Employee" only ever
// puts one entry here — General leaves it empty.
const targetPersonSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
    name: { type: String, required: true },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
  },
  { _id: false }
);

const escalationSchema = new mongoose.Schema(
  {
    // Snapshotted at creation time, same reasoning as Referral.js's
    // denormalized requisition fields — stays meaningful even if the
    // creator's own Onboarding record changes later.
    createdBy: {
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Onboarding', required: true },
      name: { type: String, required: true },
      email: { type: String, default: '' },
      mobile: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
    },

    escalationFor: {
      type: String,
      enum: ['BO Employee', 'General'],
      required: true,
    },
    targetEmployees: { type: [targetPersonSchema], default: [] },

    rating: { type: String, enum: ['Good', 'Bad', 'Neutral'], required: true },

    category: {
      type: String,
      enum: [
        'Reminder', 'POSH', 'Misbehaviour', 'Absent from Work', 'Refused Offer',
        'Refused to Join', 'Blacklisted', 'Good Work', 'Provided a Reference', 'Other',
      ],
      required: true,
    },
    mode: {
      type: String,
      enum: ['Call', 'Video Call', 'Email', 'Face to Face', 'WhatsApp', 'Physical Letter', 'Other'],
      required: true,
    },

    subject: { type: String, default: '' },
    message: { type: String, required: true, trim: true },

    attachmentUrl: { type: String, default: '' },
    attachmentName: { type: String, default: '' },
  },
  { timestamps: true }
);

escalationSchema.index({ createdAt: -1 });
escalationSchema.index({ category: 1 });
escalationSchema.index({ 'createdBy.employeeId': 1 });

module.exports = mongoose.model('Escalation', escalationSchema);
