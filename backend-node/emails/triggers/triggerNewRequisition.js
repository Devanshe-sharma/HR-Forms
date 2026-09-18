const sendNewRequisitionStarted = require('../senders/sendNewRequisitionStarted');

async function triggerNewRequisition(doc) {
  try {
    // No mail until HR has explicitly approved the requisition (see
    // PATCH /:id/approve in routes/hiringRequisitions.js) — a requisition
    // just raised and still "Awaiting Approval" must not notify anyone yet.
    if (!doc.hr_approved_at) {
      console.log('[triggerNewRequisition] Requisition not yet approved; skipping send.');
      return;
    }
    await sendNewRequisitionStarted(doc);
  } catch (err) {
    console.error('[triggerNewRequisition] Email error:', err.message);
  }
}

module.exports = triggerNewRequisition;