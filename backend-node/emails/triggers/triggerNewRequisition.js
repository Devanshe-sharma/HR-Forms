const sendNewRequisitionStarted = require('../senders/sendNewRequisitionStarted');

async function triggerNewRequisition(doc) {
  try {
    await sendNewRequisitionStarted(doc);
  } catch (err) {
    console.error('[triggerNewRequisition] Email error:', err.message);
  }
}

module.exports = triggerNewRequisition;