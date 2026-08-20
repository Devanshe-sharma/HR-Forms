const { sendMail } = require('../mailer');
const template = require('../templates/outOfOfficeNotice');

// Fixed default cc for every Out of Office notice — not the person out of
// office or the submitter, only these two, plus whoever is explicitly added
// via the "Keep in Cc" field.
const DEFAULT_OOO_CC = ['HR@briskolive.com', 'Sunil.prem@briskolive.com'];

function buildOutOfOfficeCc(doc) {
  const hr = (process.env.HR_HEAD_EMAIL || '').trim().toLowerCase();
  const raw = [
    ...DEFAULT_OOO_CC,
    ...(doc.ccEmployees || []).map((e) => e.email),
  ].filter(Boolean).map((e) => e.trim()).filter(Boolean);

  const seen = new Set();
  const deduped = [];
  for (const email of raw) {
    const key = email.toLowerCase();
    if (key === hr || seen.has(key)) continue;
    seen.add(key);
    deduped.push(email);
  }
  return deduped.join(',');
}

async function sendOutOfOfficeNotice(doc) {
  const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { subject, html } = template(plainDoc);

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to: process.env.HR_HEAD_EMAIL,
    cc: buildOutOfOfficeCc(plainDoc),
    subject,
    html,
  });
}

module.exports = sendOutOfOfficeNotice;
