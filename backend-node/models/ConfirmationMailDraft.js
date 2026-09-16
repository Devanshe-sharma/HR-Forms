const mongoose = require('mongoose');

// Every Confirmation mail (Manager Request, Manager Reminder, Management
// Request, Management Reminder, HR Notify, the quarterly digest) lands
// here as a DRAFT instead of being sent automatically — same convention
// as SalaryRevisionMailDraft.js. HR reviews/edits the subject & body from
// the dashboard and sends it manually; nothing here is ever auto-dispatched.
const confirmationMailDraftSchema = new mongoose.Schema({
  // Not every mail type is about one specific confirmation record (the
  // quarterly digest spans many employees) — null is expected/normal for
  // those.
  confirmationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Confirmations', default: null },
  mailType: {
    type: String,
    enum: [
      'managerRequest',       // Mail 1 -> Manager
      'managerReminder',      // Mail 1a -> Manager
      'managementRequest',    // Mail 2 -> Management
      'managementReminder',   // Mail 2a -> Management
      'hrNotify',              // Mail 3 -> HR
      'quarterlyDigest',       // -> Management
    ],
    required: true,
  },
  // Denormalized for a readable queue list without joining back to the
  // confirmation record (and quarterlyDigest has no single employee at all).
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

confirmationMailDraftSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ConfirmationMailDraft', confirmationMailDraftSchema);
