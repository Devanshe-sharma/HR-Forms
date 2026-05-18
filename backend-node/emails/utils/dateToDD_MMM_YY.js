function dateToDD_MMM_YY(date) {
  if (!date) return "Pending";
  const tempDate = new Date(date);
  if (isNaN(tempDate.getTime())) return "Pending";
  const year  = tempDate.getFullYear();
  const month = tempDate.toLocaleString("default", { month: "short" });
  const dateNo = tempDate.getDate();
  return `${dateNo} ${month} ${year}`;
}
 
module.exports = dateToDD_MMM_YY;