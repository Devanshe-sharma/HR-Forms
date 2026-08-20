const sendOutOfOfficeNotice = require('../senders/sendOutOfOfficeNotice');

async function triggerOutOfOfficeNotice(doc) {
  try {
    await sendOutOfOfficeNotice(doc);
  } catch (err) {
    console.error('[triggerOutOfOfficeNotice] Email error:', err.message);
  }
}

module.exports = triggerOutOfOfficeNotice;
