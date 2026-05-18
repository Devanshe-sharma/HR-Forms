// Renders checkLists array into an HTML table for emails
function checklistTable(checkLists = []) {
  if (!checkLists.length) return "<p>No checklist data.</p>";

  const STATUS_COLOR = {
    "DONE":          "#15803d",
    "DONE (DELAYED)":"#1d4ed8",
    "OVERDUE":       "#dc2626",
    "PENDING":       "#d97706",
    "NOT YET DUE":   "#64748b",
  };

  let html = "";

  for (const list of checkLists) {
    html += `
      <h3 style="margin:16px 0 6px;font-size:13px;color:#1e293b;
                 border-bottom:2px solid #e2e8f0;padding-bottom:4px;">
        ${list.name}
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0"
             style="border-collapse:collapse;font-size:12px;margin-bottom:8px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th align="left"  style="border:1px solid #e2e8f0;padding:6px 10px;">#</th>
            <th align="left"  style="border:1px solid #e2e8f0;padding:6px 10px;">Task</th>
            <th align="center"style="border:1px solid #e2e8f0;padding:6px 10px;">Status</th>
            <th align="center"style="border:1px solid #e2e8f0;padding:6px 10px;">Plan Date</th>
            <th align="center"style="border:1px solid #e2e8f0;padding:6px 10px;">Done Date</th>
            <th align="center"style="border:1px solid #e2e8f0;padding:6px 10px;">Score</th>
          </tr>
        </thead>
        <tbody>
    `;

    (list.itemsList || []).forEach((item, i) => {
      const color  = STATUS_COLOR[item.status] ?? "#64748b";
      const plan   = item.planDate ? new Date(item.planDate).toLocaleDateString("en-IN") : "—";
      const done   = item.doneDate ? new Date(item.doneDate).toLocaleDateString("en-IN") : "—";
      const score  = item.score != null ? item.score : "—";
      const bg     = i % 2 === 0 ? "#ffffff" : "#f8fafc";

      html += `
        <tr style="background:${bg};">
          <td style="border:1px solid #e2e8f0;padding:5px 10px;">${i + 1}</td>
          <td style="border:1px solid #e2e8f0;padding:5px 10px;">${item.name || "—"}</td>
          <td align="center" style="border:1px solid #e2e8f0;padding:5px 10px;
              color:${color};font-weight:600;">${item.status || "—"}</td>
          <td align="center" style="border:1px solid #e2e8f0;padding:5px 10px;">${plan}</td>
          <td align="center" style="border:1px solid #e2e8f0;padding:5px 10px;">${done}</td>
          <td align="center" style="border:1px solid #e2e8f0;padding:5px 10px;
              color:${(item.score ?? 0) < 0 ? "#dc2626" : "#15803d"};font-weight:600;">${score}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
  }

  return html;
}

module.exports = checklistTable;