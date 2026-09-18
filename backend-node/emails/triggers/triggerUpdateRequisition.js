const sendRequisitionCancelled       = require('../senders/sendRequisitionCancelled');
const sendRequisitionUpdateProgress  = require('../senders/sendRequisitionUpdateProgress');

async function triggerUpdateRequisition(doc) {
  try {
    // Same approval gate as triggerNewRequisition — if nobody was ever
    // notified this requisition exists, nobody needs a cancelled/progress
    // update about it either.
    if (!doc.hr_approved_at) {
      console.log('[triggerUpdateRequisition] Requisition not yet approved; skipping send.');
      return;
    }

    if (doc.hiring_status === 'Cancelled') {
      await sendRequisitionCancelled(doc);
      return;
    }

    await sendRequisitionUpdateProgress(doc);
  } catch (err) {
    console.error('[triggerUpdateRequisition] Email error:', err.message);
  }
}

module.exports = triggerUpdateRequisition;