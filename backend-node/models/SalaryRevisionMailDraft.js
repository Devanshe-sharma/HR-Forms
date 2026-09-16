const mongoose = require('mongoose');

// Every Salary Revision mail (Mail 1-6, HR notify, the quarterly digest)
// now lands here as a DRAFT instead of being sent automatically — HR
// reviews/edits the subject & body from the dashboard's Mail Queue and
// sends it manually. The only thing that still goes out on its own is a
// separate "you have drafts to review" notification to HR itself (see
// sendSalaryRevisionMailQueueDigest.js) — nothing here is ever
// auto-dispatched to a Manager, Management, or an Employee.
const salaryRevisionMailDraftSchema = new mongoose.Schema({
  // Not every mail type is about one specific revision (the quarterly
  // digest spans many employees) — null is expected/normal for those.
  revisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryRevision', default: null },
  mailType: {
    type: String,
    enum: [
      'managerRequest',       // Mail 1 -> Manager
      'managementApproval',   // Mail 2 -> Management
      'pipHold',               // -> Employee
      'hrNotify',              // -> HR
      'managerEscalation',     // Mail 5 -> Manager
      'finalEscalation',       // Mail 6 -> HR Head
      'employeeConfirmation',  // Mail 3 -> Employee
      'quarterlyDigest',       // -> Management
    ],
    required: true,
  },
  // Denormalized for a readable queue list without joining back to the
  // revision (and quarterlyDigest has no single employee at all).
  employeeName: { type: String, default: '' },
  to     : { type: String, required: true },
  cc     : { type: String, default: '' },
  bcc    : { type: String, default: '' },
  subject: { type: String, required: true },
  html   : { type: String, required: true },
  status : { type: String, enum: ['draft', 'sent', 'discarded'], default: 'draft' },
  sentAt : { type: Date, default: null },
  sentBy : { type: String, default: '' },
}, { timestamps: true });

salaryRevisionMailDraftSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SalaryRevisionMailDraft', salaryRevisionMailDraftSchema);
