function checklistTable(checkLists = []) {
  if (!checkLists.length) return "";
 
  const dateToDD_MMM_YY = require("./dateToDD_MMM_YY");
 
  let html = `
    <table style="border: 1px solid; border-collapse: collapse;">
      <tr style="border: 1px solid; font-weight: bold; background-color:lightgrey;">
        <th style="border: 1px solid;">Ser</th>
        <th style="border: 1px solid;">Task</th>
        <th style="border: 1px solid;">Status</th>
        <th style="border: 1px solid;">Score</th>
        <th style="border: 1px solid;">Days Left</th>
      </tr>
  `;
 
  let ser = 0;
 
  for (const list of checkLists) {
    const planDateStr = list.planDate ? dateToDD_MMM_YY(list.planDate) : "Pending";
 
    // Section header row — matches Apps Script sectionHeader format
    html += `
      <tr>
        <td> - </td>
        <td style="vertical-align: top;"><b>${list.name}</b> Planned Date: <b>${planDateStr}</b></td>
        <td> - </td>
        <td> - </td>
        <td> - </td>
      </tr>
    `;
 
    const items = list.items || list.itemsList || [];
 
    for (const item of items) {
      ser++;
 
      const heading  = item.doneHeader || item.name || "-";
      const status   = item.status   || "-";
      const score    = item.score  != null ? item.score  : "-";
      const daysLeft = item.daysLeft != null ? item.daysLeft : "NA";
 
      // Row color — matches Apps Script exactly
      let rowStyle = "";
      if (status === "DONE")           rowStyle = "border: 1px solid; color:green;";
      else if (status === "DONE (DELAYED)") rowStyle = "border: 1px solid; color:blue;";
      else if (status === "OVERDUE")   rowStyle = "border: 1px solid; color:red; background-color:yellow;";
      else if (status === "PENDING")   rowStyle = "border: 1px solid; color:black; background-color:yellow;";
      else                             rowStyle = "border: 1px solid; color:black;";
 
      html += `
        <tr style="${rowStyle}">
          <td style="border: 1px solid; vertical-align: top;">${ser}</td>
          <td style="border: 1px solid; vertical-align: top;">${heading}</td>
          <td style="border: 1px solid; vertical-align: top;">${status}</td>
          <td style="border: 1px solid; vertical-align: top;">${score}</td>
          <td style="border: 1px solid; vertical-align: top;">${daysLeft}</td>
        </tr>
      `;
    }
  }
 
  html += `</table>`;
  return html;
}
 
module.exports = checklistTable;