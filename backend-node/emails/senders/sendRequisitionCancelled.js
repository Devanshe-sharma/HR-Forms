const sendEmail = require('../sendEmail');
const { REQUISITION_DASHBOARD_LINK, collectCcList } = require('../utils/requisitionEmailHelpers');

// Sent when a requisition's hiring_status is updated to "Cancelled" —
// mirrors the old Apps Script's early-exit closure email for "Hiring
// Stopped". Note the status string is different here: the old sheet used
// "Hiring Stopped" / "Not Joined, Hiring Stopped", but this system's
// actual HIRING_STATUS_OPTIONS (see NewRequisitionForm.tsx) uses
// "Cancelled" instead — there's no literal "Hiring Stopped" value in the
// new schema, so this triggers off "Cancelled" to match what can actually
// be selected.
async function sendRequisitionCancelled(doc) {
  const html = `
    <p style="font-size:16px;">Dear HR,</p>
    <p>Update on: <b>${doc.designation || '—'}</b> Dept: <b>${doc.hiring_dept || '—'}</b><br>
    Requisitioner: <b>${doc.requisitioner_name || '—'}</b><br>
    <a href="${REQUISITION_DASHBOARD_LINK}" target="_blank">Open Requisition Dashboard</a></p>
    <p style="font-weight:bold; font-size:16px; color:red;">
      ${doc.designation || '—'} in ${doc.hiring_dept || '—'} is NOT required.
      The requisition has been cancelled.
    </p>
    ${doc.hr_remarks ? `<p>HR Remarks: <b>${doc.hr_remarks}</b></p>` : ''}
  `;

  return sendEmail({
    to: doc.requisitioner_email || 'hr.manager@briskolive.com',
    cc: collectCcList(doc),
    subject: `${doc.designation || 'Position'} - Hiring Requisition Cancelled`,
    html,
  });
}

module.exports = sendRequisitionCancelled;