// sendReferralInvite.js
const { sendMail } = require("../mailer");
const template     = require("../templates/referralInvite");
const buildCc      = require("../../utils/buildCc");
const resolveJdAndRoleLinks = require("../../utils/resolveJdAndRoleLinks");

async function sendReferralInvite(doc) {
  // toObject() first — doc is a real Mongoose document here (from
  // rescoreAndSave in routes/hiringRequisitions.js), and spreading/
  // overriding fields directly on a Document instance is unreliable.
  const plainDoc = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { jd_link, role_link } = await resolveJdAndRoleLinks(plainDoc);
  const enrichedDoc = { ...plainDoc, jd_link, role_link };

  const { subject, html } = template(enrichedDoc);
  await sendMail({
    from:    `"Brisk Olive HR" <${process.env.HR_HEAD_EMAIL}>`,
    to:      process.env.ALL_EMAIL,
    cc:      buildCc(doc, process.env.ALL_EMAIL),
    subject, html,
  });
}

module.exports = sendReferralInvite;
