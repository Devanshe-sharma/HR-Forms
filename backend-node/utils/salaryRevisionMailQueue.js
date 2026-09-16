const SalaryRevisionMailDraft = require('../models/SalaryRevisionMailDraft');

// Called by every Salary Revision mail sender INSTEAD OF emails/sendEmail —
// per explicit instruction (2026-09-15), no Salary Revision mail sends
// itself anymore. It's saved as an editable draft; only HR sending it from
// the dashboard's Mail Queue (see routes/salaryRevisionMailDrafts.js)
// actually calls sendEmail.
async function queueSalaryRevisionMail({ revisionId, mailType, employeeName, to, cc, subject, html }) {
  return SalaryRevisionMailDraft.create({
    revisionId: revisionId || null,
    mailType,
    employeeName: employeeName || '',
    to,
    cc: cc || '',
    subject,
    html,
  });
}

module.exports = { queueSalaryRevisionMail };
