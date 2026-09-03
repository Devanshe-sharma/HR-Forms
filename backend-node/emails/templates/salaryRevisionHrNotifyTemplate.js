const dateToDD_MMM_YY = require('../utils/dateToDD_MMM_YY');
const signature = require('../utils/signature');

// Small, informational-only notice to HR — fires once BOTH the manager and
// management have submitted their decision (stage lands on 'pending_hr' for
// an increment, or 'on_hold' for an approved PIP). No action link — HR's
// actual finalisation step still happens on the dashboard (PUT /:id/hr /
// pip-outcome), this is just "heads up, this one needs you now".
function salaryRevisionHrNotifyTemplate({
  employeeName, department, designation, previousCtc, isPip, finalPct, reviewDate,
}) {
  const subject = isPip
    ? `Salary Revision — PIP Approved for ${employeeName}`
    : `Salary Revision Ready for HR — ${employeeName}`;

  const decisionLine = isPip
    ? `Management has approved placing <b>${employeeName}</b> on a Performance Improvement Plan. Review date: <b>${dateToDD_MMM_YY(reviewDate)}</b>.`
    : `Management has approved a <b>${finalPct}%</b> increment for <b>${employeeName}</b> (current CTC ₹${Number(previousCtc || 0).toLocaleString('en-IN')}). Kindly finalise this revision on the Salary Revision dashboard.`;

  const html = `
    <p>Dear HR,</p>
    <p>${decisionLine}</p>
    <p style="font-size:13px; color:#64748b;">${designation || '-'} · ${department || '-'}</p>
    ${signature()}
  `;

  return { subject, html };
}

module.exports = salaryRevisionHrNotifyTemplate;
