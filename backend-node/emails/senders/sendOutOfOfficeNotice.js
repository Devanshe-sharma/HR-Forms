const { sendMail } = require('../mailer');
const template = require('../templates/outOfOfficeNotice');

// Sending is live — asked to start 2026-09-23. (Was paused for testing
// earlier the same day.)
const SEND_ENABLED = true;

// Fixed default cc for every Out of Office notice — not the person out of
// office or the submitter, only these, plus whoever is explicitly added via
// the "Keep in Cc" field. Sunil Prem removed 2026-09-23, re-added same day
// per explicit request.
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
  const to = process.env.HR_HEAD_EMAIL;
  const cc = buildOutOfOfficeCc(plainDoc);

  if (!SEND_ENABLED) {
    console.log(`[sendOutOfOfficeNotice] Sending disabled — would have emailed ${plainDoc.person?.name || 'this OOO entry'} — to: ${to} | cc: ${cc || '(none)'}`);
    return;
  }

  await sendMail({
    from: `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to,
    cc,
    subject,
    html,
  });
}

module.exports = sendOutOfOfficeNotice;
