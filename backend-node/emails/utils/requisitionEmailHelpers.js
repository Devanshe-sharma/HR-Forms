// Shared helpers for the new/update requisition emails — kept in one place
// so all three sender modules (new, update, cancelled) stay consistent
// instead of each reimplementing the same CC list / checklist table logic
// slightly differently.

// Same env-var convention already used elsewhere in this backend (see
// routes/onboardingroutes.js's generate-access-link route) — falls back to
// the real production URL if FRONTEND_URL isn't set.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hr.briskolive.com';
const REQUISITION_DASHBOARD_LINK = `${FRONTEND_URL}/recruitment`;

// Same standing CC list the old Apps Script hard-coded for every hiring
// email — carried over as-is.
const STANDARD_CC = [
  'sunil.prem@briskolive.com',
  'amitmathur@briskolive.com',
  'project.manager@briskolive.com',
  'admin@briskolive.com',
  'da.automation@briskolive.com',
  'accounts@briskolive.com',
];

function fmtDate(d) {
  if (!d) return '—';
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

// Builds the standard CC list for a requisition email: the standing list
// plus whichever of dept head / dept group / additional CC recipients are
// actually set on this specific record. Deduplicated via Set so the same
// address never appears twice even if it happens to be in more than one
// of these fields.
function collectCcList(doc) {
  const cc = new Set(STANDARD_CC);
  if (doc.hiring_dept_email) cc.add(doc.hiring_dept_email);
  if (doc.dept_group_email) cc.add(doc.dept_group_email);
  (doc.employees_in_cc || []).forEach((e) => e && cc.add(e));
  return Array.from(cc).join(',');
}

// Renders the real checklist_tasks array (task/status/score/daysLeft) as
// an HTML table — this is genuine data from the document, not a
// recreation of the old sheet's per-checklist-group breakdown, since this
// system stores all 12 tasks as one flat array rather than 4 named
// sub-checklists.
function buildChecklistTable(doc) {
  const tasks = doc.checklist_tasks || [];
  if (tasks.length === 0) {
    return '<p style="color:#888;">No checklist data yet.</p>';
  }

  const rows = tasks.map((t, i) => {
    const scoreDisplay = (typeof t.score === 'number' && t.score < 0)
      ? `<span style="color:red;">${t.score}</span>`
      : (t.score ?? '—');
    const statusColor = t.status === 'Overdue' ? 'color:red;font-weight:bold;'
      : t.status === 'Done' ? 'color:green;'
      : t.status === 'Done (Delayed)' ? 'color:#b8860b;'
      : '';
    return `<tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:6px;">${t.task}</td>
      <td style="border:1px solid #ccc;padding:6px;${statusColor}">${t.status || '—'}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${scoreDisplay}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center;">${t.daysLeft ?? '—'}</td>
    </tr>`;
  }).join('');

  return `<table style="border:1px solid #ccc;border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
    <tr style="background:#f0f0f0;font-weight:bold;">
      <th style="border:1px solid #ccc;padding:6px;">Ser</th>
      <th style="border:1px solid #ccc;padding:6px;">Task</th>
      <th style="border:1px solid #ccc;padding:6px;">Status</th>
      <th style="border:1px solid #ccc;padding:6px;">Score</th>
      <th style="border:1px solid #ccc;padding:6px;">Days Left</th>
    </tr>
    ${rows}
  </table>`;
}

function coloredScore(score) {
  return (typeof score === 'number' && score < 0)
    ? `<span style="color:red;">${score}</span>`
    : (score ?? 0);
}

module.exports = {
  REQUISITION_DASHBOARD_LINK,
  STANDARD_CC,
  fmtDate,
  collectCcList,
  buildChecklistTable,
  coloredScore,
};