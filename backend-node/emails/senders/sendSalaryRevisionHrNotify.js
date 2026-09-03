const sendEmail = require('../sendEmail');
const salaryRevisionHrNotifyTemplate = require('../templates/salaryRevisionHrNotifyTemplate');

// Live as of 2026-09-02.
const RECIPIENT = process.env.HR_EMAIL || 'hr.manager@briskolive.com';

// Call right after applyManagementDecision lands a revision on 'pending_hr'
// (increment approved) or 'on_hold' (PIP approved) — i.e. once BOTH the
// manager and management have submitted their decision.
async function sendSalaryRevisionHrNotify(revision) {
  const isPip = revision.stage === 'on_hold';

  const { subject, html } = salaryRevisionHrNotifyTemplate({
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    previousCtc: revision.previousCtc,
    isPip,
    finalPct: revision.managementDecision?.finalPct,
    reviewDate: revision.reviewDate,
  });

  await sendEmail({ to: RECIPIENT, subject, html });
}

module.exports = sendSalaryRevisionHrNotify;
