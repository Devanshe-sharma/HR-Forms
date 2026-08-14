// sendReferralInvite.js
const mongoose     = require("mongoose");
const { sendMail } = require("../mailer");
const template     = require("../templates/referralInvite");
const buildCc      = require("../../utils/buildCc");
const { ROLE_MASTER_COLLECTION } = require("../../models/role_master");

// Falls back to the Dept/Designation Master's own JD / role document links
// whenever the requisition itself doesn't have them attached — same
// fallback reasoning as routes/applicantRecords.js's resolveJdLink(): older
// or hastily-raised requisitions often leave these blank even though the
// role already has real docs on file in Role Master.
//
// Queries the raw collection directly instead of the RoleMaster Mongoose
// model — the model's schema paths (desig_id, jd_link, role_document_link)
// don't actually match the real stored field names, which are still the
// original spreadsheet-import headers ("Desig_id", "JD Link",
// "Role Document Link"), so RoleMaster.findOne({desig_id: ...}) silently
// matches nothing. Confirmed directly against the live collection.
async function resolveJdAndRoleLinks(doc) {
  let jd_link = doc.jd_link || '';
  let role_link = doc.role_link || '';

  if ((!jd_link || !role_link) && doc.designation_id != null) {
    const role = await mongoose.connection.db
      .collection(ROLE_MASTER_COLLECTION)
      .findOne({ Desig_id: doc.designation_id });

    if (!jd_link && role) {
      jd_link = role['JD Link'] || role.jd_link || role.JD_Link || '';
    }
    if (!role_link && role) {
      role_link = role['Role Document Link'] || role.role_document_link || role.Role_Document_Link || '';
    }
  }

  return { jd_link, role_link };
}

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
