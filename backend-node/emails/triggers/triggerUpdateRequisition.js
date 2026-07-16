const sendRequisitionCancelled       = require('../senders/sendRequisitionCancelled');
const sendRequisitionUpdateProgress  = require('../senders/sendRequisitionUpdateProgress');

async function triggerUpdateRequisition(doc) {
  try {
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