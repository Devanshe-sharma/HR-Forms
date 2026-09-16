const sendEmail = require('../sendEmail');
const SalaryRevisionMailDraft = require('../../models/SalaryRevisionMailDraft');

// The ONE exception to "no Salary Revision mail sends itself" (2026-09-15
// instruction) — a real, actual send, but it only ever goes to HR, never
// a Manager/Management/Employee. Its entire job is to tell HR "N mails are
// waiting in your queue," not to act on anyone's behalf. Everything else
// in this feature (Mail 1-6, HR notify, the quarterly digest) is queued as
// an editable draft and only ever sent by HR clicking Send in the
// dashboard's Mail Queue — see utils/salaryRevisionMailQueue.js.
const RECIPIENT = process.env.HR_HEAD_EMAIL || 'hr.head@briskolive.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';

const MAIL_TYPE_LABEL = {
  managerRequest: 'Request Manager (Mail 1)',
  managementApproval: 'Management Approval (Mail 2)',
  pipHold: 'PIP Hold Notice',
  hrNotify: 'HR Notify',
  managerEscalation: 'Reminder to Manager (Mail 5)',
  finalEscalation: 'Escalate Delay to Management (Mail 6)',
  employeeConfirmation: 'Employee Confirmation (Mail 3)',
  quarterlyDigest: 'Quarterly Due Digest',
};

async function sendSalaryRevisionMailQueueDigest() {
  const drafts = await SalaryRevisionMailDraft.find({ status: 'draft' }).sort({ createdAt: 1 }).lean();
  if (!drafts.length) return { queuedCount: 0 };

  const rows = drafts.map((d) => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${MAIL_TYPE_LABEL[d.mailType] || d.mailType}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${d.employeeName || '—'}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${d.to}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${new Date(d.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</td>
    </tr>`).join('');

  const html = `
    <p>Dear HR,</p>
    <p>There are <b>${drafts.length}</b> Salary Revision mail(s) waiting in the Mail Queue for your review and approval before they go out.</p>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Mail Type</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Employee</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">To</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Queued On</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${FRONTEND_URL}/salary-revision">Open the Mail Queue</a> to review, edit, and send.</p>
  `;

  await sendEmail({
    to: RECIPIENT,
    subject: `Salary Revision — ${drafts.length} mail(s) awaiting your review`,
    html,
  });

  return { queuedCount: drafts.length };
}

module.exports = sendSalaryRevisionMailQueueDigest;
