// utils/resolveJdAndRoleLinks.js
const mongoose = require('mongoose');
const { ROLE_MASTER_COLLECTION } = require('../models/role_master');

// Falls back to the Dept/Designation Master's own JD / role document links
// whenever a requisition doesn't have them attached directly — used by both
// the referral-invite email (emails/senders/sendReferralInvite.js) and the
// public referral form (GET /:id/referral-info in routes/hiringRequisitions.js)
// so both surfaces resolve the exact same way.
//
// Queries the raw collection directly instead of the RoleMaster Mongoose
// model — the model's schema paths (desig_id, jd_link, role_document_link)
// don't reliably match the real stored field names. The collection is a
// mix of two conventions: legacy spreadsheet-imported rows use
// "Desig_id"/"JD Link"/"Role Document Link" (capitalized, spaced), while
// rows created through the app itself (routes/roles.js -> RoleMaster.create)
// correctly use the schema's own lowercase fields. Both are checked.
//
// desig_id also isn't reliably unique in this collection (confirmed: e.g.
// 1605 is shared by two entirely different designations) — when more than
// one row shares the id, prefer the one whose designation name actually
// matches this requisition's, rather than an arbitrary first match that
// could belong to an unrelated role.
async function resolveJdAndRoleLinks(doc) {
  let jd_link = doc.jd_link || '';
  let role_link = doc.role_link || '';

  if ((!jd_link || !role_link) && doc.designation_id != null) {
    const candidates = await mongoose.connection.db
      .collection(ROLE_MASTER_COLLECTION)
      .find({ $or: [{ desig_id: doc.designation_id }, { Desig_id: doc.designation_id }] })
      .toArray();

    const wanted = (doc.designation || '').trim().toLowerCase();
    const role = candidates.length <= 1
      ? candidates[0]
      : (candidates.find((r) => ((r.designation || r.Designation || '').trim().toLowerCase()) === wanted) || candidates[0]);

    if (!jd_link && role) {
      jd_link = role.jd_link || role['JD Link'] || role.JD_Link || '';
    }
    if (!role_link && role) {
      role_link = role.role_document_link || role['Role Document Link'] || role.Role_Document_Link || '';
    }
  }

  return { jd_link, role_link };
}

module.exports = resolveJdAndRoleLinks;
