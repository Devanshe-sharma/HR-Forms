// Gates the manual "Send" button on a Confirmation mail draft — separate
// kill switch from SALARY_REVISION_MAILS_ENABLED, so Confirmation mail
// sending can be turned on independently. Defaults OFF (mail-safe); set
// CONFIRMATION_MAILS_ENABLED=true in .env once ready to let sends go out.
// See routes/confirmationMailDrafts.js's POST /:id/send for the only
// place this is checked.
const CONFIRMATION_MAILS_ENABLED = process.env.CONFIRMATION_MAILS_ENABLED === 'true';

module.exports = { CONFIRMATION_MAILS_ENABLED };
