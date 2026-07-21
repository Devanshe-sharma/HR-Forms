// Renders a date explicitly in IST (Asia/Kolkata), regardless of what
// timezone the Node process itself happens to be running in.
//
// The bug this fixes: a date picked in the browser as "16 Jul" (IST,
// midnight local) gets converted to UTC before being sent to the
// backend — "16 Jul 00:00 IST" becomes "15 Jul 18:30 UTC". If the
// server then reads the calendar date using .getDate() (which returns
// the date in the SERVER's own local timezone), and that server happens
// to run in UTC — very common for cloud hosting — it reads "15," not
// "16," even though "16" is what was actually picked. Explicitly
// specifying timeZone: "Asia/Kolkata" here means the displayed date is
// correct no matter what timezone the server process itself is in.
function formatDateIST(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const day   = d.toLocaleString("en-GB", { day: "2-digit", timeZone: "Asia/Kolkata" });
  const month = d.toLocaleString("en-GB", { month: "short",  timeZone: "Asia/Kolkata" });
  const year  = d.toLocaleString("en-GB", { year: "numeric", timeZone: "Asia/Kolkata" });

  return `${day} ${month} ${year}`;
}

module.exports = formatDateIST;