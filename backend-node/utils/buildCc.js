const DEFAULT_CC = process.env.DEFAULT_CC_EMAILS || '';

function buildCc(doc, extraCc = '') {
  const parts = [];

  if (DEFAULT_CC) parts.push(DEFAULT_CC);
  if (extraCc)    parts.push(extraCc);
  if (doc.deptHeadEmail) parts.push(doc.deptHeadEmail);
  if (doc.employeesInCc?.length) {
    parts.push(
      Array.isArray(doc.employeesInCc)
        ? doc.employeesInCc.join(',')
        : doc.employeesInCc
    );
  }

  const all = parts.join(',').split(',').map(e => e.trim()).filter(Boolean);
  return [...new Set(all)].join(',');
}

module.exports = buildCc;