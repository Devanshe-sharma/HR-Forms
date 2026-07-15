const sendEmail = require('../sendEmail');
const {
  REQUISITION_DASHBOARD_LINK,
  fmtDate,
  collectCcList,
  buildChecklistTable,
  coloredScore,
} = require('../utils/requisitionEmailHelpers');

// Sent to HR whenever a new hiring requisition is submitted — mirrors the
// old Apps Script's userSubmitNewHiring() main-path email, adapted to this
// system's real field names and linking to the Requisition Dashboard
// instead of the old Sheet/Apps-Script webapp links.
async function sendNewRequisitionStarted(doc) {
  const html = `
    <p style="font-size:16px;">Dear HR,</p>
    <p>Here is a <b>New Hiring Requirement</b>:<br>
    Designation: <b>${doc.designation || '—'}</b><br>
    Hiring Dept: <b>${doc.hiring_dept || '—'}</b><br>
    Requisitioner: <b>${doc.requisitioner_name || '—'}</b><br>
    Email: <b>${doc.requisitioner_email || '—'}</b><br>
    ${doc.role_link ? `<a href="${doc.role_link}" target="_blank">Role Link</a><br>` : ''}
    ${doc.jd_link ? `<a href="${doc.jd_link}" target="_blank">JD Link</a><br>` : ''}
    Candidate Experience Level: <b>${doc.candidate_experience_level || '—'}</b><br>
    <a href="${REQUISITION_DASHBOARD_LINK}" target="_blank">Open Requisition Dashboard</a>
    </p>
    <ul>
      <li>Hiring Status: <b>${doc.hiring_status || '—'}</b></li>
      <li>Planned - Start Sharing CVs: <b>${fmtDate(doc.plan_start_sharing_cvs)}</b></li>
      <li>Planned Interviews Started: <b>${fmtDate(doc.planned_interviews_started)}</b></li>
      <li>Planned Offer Accepted: <b>${fmtDate(doc.planned_offer_accepted)}</b></li>
      <li>Planned Joining: <b>${fmtDate(doc.planned_joined)}</b></li>
      <li>FMS Score: <b>${coloredScore(doc.fms_score)}</b>
        (Total: ${doc.total_tasks ?? 0}, On time: ${doc.done_in_time ?? 0},
        Delayed: ${doc.done_but_delayed ?? 0},
        Overdue: <span style="color:red;">${doc.tasks_overdue ?? 0}</span>,
        Due: ${doc.tasks_due ?? 0}, Not due: ${doc.not_yet_due ?? 0})</li>
      <li>Special Instructions: <b>${doc.special_instructions || '—'}</b></li>
      <li><b>HR Hiring Checklist:</b></li>
    </ul>
    ${buildChecklistTable(doc)}
  `;

  return sendEmail({
    to: 'hr.manager@briskolive.com,hr.head@briskolive.com',
    cc: collectCcList(doc),
    subject: `New Hiring Requisition #${doc.serial_no} : ${doc.designation || '?'} , ${doc.hiring_dept || '?'}`,
    html,
  });
}

module.exports = sendNewRequisitionStarted;