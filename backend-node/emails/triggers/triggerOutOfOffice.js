const sendOutOfOfficeNotice = require('../senders/sendOutOfOfficeNotice');
const sendOutOfOfficeManagerApproval = require('../senders/sendOutOfOfficeManagerApproval');

async function triggerOutOfOfficeNotice(doc) {
  try {
    await sendOutOfOfficeNotice(doc);
  } catch (err) {
    console.error('[triggerOutOfOfficeNotice] Email error:', err.message);
  }
}

async function triggerOutOfOfficeManagerApproval(doc) {
  try {
    await sendOutOfOfficeManagerApproval(doc);
  } catch (err) {
    console.error('[triggerOutOfOfficeManagerApproval] Email error:', err.message);
  }
}

module.exports = { triggerOutOfOfficeNotice, triggerOutOfOfficeManagerApproval };
