const sendEmail = require('../sendEmail');
const {
  REQUISITION_DASHBOARD_LINK,
  fmtDate,
  collectCcList,
  buildChecklistTable,
  coloredScore,
} = require('../utils/requisitionEmailHelpers');

// Sent to the requisitioner whenever a requisition is updated (dashboard
// edit — status change, checklist progress, etc.). Mirrors the old Apps
// Script's userClickedUpdateHiringForm() progress email, adapted to real
// field names.
//
// NOTE: the old script's email included a 5-row "Planned vs Actual" table
// (actual CV-sharing start, actual interview start, actual offer date,
// actual join date). This system's schema has no equivalent actual-date
// fields anywhere (checked the routes file, the model's implied shape,
// and the New Requisition form) — only the planned_* dates exist. That
// comparison table is intentionally left out here rather than inventing
// fields that don't exist; if you want that tracking, the schema needs
// those fields added first.
async function sendRequisitionUpdateProgress(doc) {
  const html = `
    <p style="font-size:16px;">Dear All,</p>
    <p>Update on: <b>${doc.designation || '—'}</b> Dept: <b>${doc.hiring_dept || '—'}</b><br>
    Requisitioner: <b>${doc.requisitioner_name || '—'}</b><br>
    <a href="${REQUISITION_DASHBOARD_LINK}" target="_blank">Open Requisition Dashboard</a><br>
    Hiring Status: <b>${doc.hiring_status || '—'}</b>
    ${doc.hr_remarks ? ` (HR Remarks: <b>${doc.hr_remarks}</b>)` : ''}
    </p>
    <ul>
      <li>Planned - Start Sharing CVs: <b>${fmtDate(doc.plan_start_sharing_cvs)}</b></li>
      <li>Planned Interviews Started: <b>${fmtDate(doc.planned_interviews_started)}</b></li>
      <li>Planned Offer Accepted: <b>${fmtDate(doc.planned_offer_accepted)}</b></li>
      <li>Planned Joining: <b>${fmtDate(doc.planned_joined)}</b></li>
      <li>FMS Score: <b>${coloredScore(doc.fms_score)}</b>
        (Total Tasks: ${doc.total_tasks ?? 0}, Done in Time: ${doc.done_in_time ?? 0},
        Done but Delayed: ${doc.done_but_delayed ?? 0},
        <span style="color:red;background-color:yellow;">Overdue: ${doc.tasks_overdue ?? 0}</span>,
        <span style="background-color:yellow;">Pending: ${doc.tasks_due ?? 0}</span>,
        Not Yet Due: ${doc.not_yet_due ?? 0})</li>
    </ul>
    ${buildChecklistTable(doc)}
  `;

  return sendEmail({
    to: doc.requisitioner_email || 'hr.manager@briskolive.com',
    cc: collectCcList(doc),
    subject: `Recruitment Progress: ${doc.designation || '?'} , ${doc.hiring_dept || '?'}`,
    html,
  });
}

module.exports = sendRequisitionUpdateProgress;