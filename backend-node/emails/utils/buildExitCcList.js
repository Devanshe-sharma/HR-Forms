// Builds a comma-separated CC list matching the original Apps Script's
// pattern: the person's own email + a fixed internal address + anyone
// listed on the record's own "Employees In Cc" field.
function buildExitCcList(doc, extra = []) {
  const primaryEmail =
    (doc.persEmail && doc.persEmail.trim()) ||
    (doc.officialEmail && doc.officialEmail.trim()) ||
    "";

  const cc = new Set();
  if (primaryEmail) cc.add(primaryEmail);
  cc.add("software.developer@briskolive.com");
  extra.forEach((e) => { if (e) cc.add(e); });

  (doc.employeesInCc || []).forEach((e) => {
    const trimmed = (e || "").trim();
    if (trimmed) cc.add(trimmed);
  });

  return Array.from(cc).join(",");
}

module.exports = buildExitCcList;
