function dateToDD_MMM_YY(dateInput) {
  if (!dateInput) return "Pending";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Pending";

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",   // no leading zero, matching the original's "14", "19" style
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(d);

  const day   = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year  = parts.find((p) => p.type === "year")?.value ?? "";

  return `${day} ${month} ${year}`;
}

module.exports = dateToDD_MMM_YY;