const sendEmail = require('../emails/sendEmail');
const Outing = require('../models/Outing');
const moment = require('moment-timezone');

// Temporary test-only override — see emailQuarterlyOutingApproval.js for
// the full explanation. Remove to restore normal recipients.
const OUTING_MAIL_OVERRIDE_TO = 'software.developer@briskolive.com';

// Pure builder — returns the To/CC/Subject/Body for this outing's update
// mail without sending anything, so both the automatic path (below) and
// the manual "preview & send" UI (routes/outing.js) can reuse the exact
// same content.
async function buildOutingProposalUpdateMail(outingId) {
  const outing = await Outing.findById(outingId).lean();
  if (!outing) throw new Error('Outing not found');

  const quarterLabel = outing.quarter && outing.financialYear
    ? `${outing.quarter} ${outing.financialYear}`
    : 'Upcoming Quarter';

  const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?tab=hr`;

  const tableRows = `
    <tr>
      <td style="padding:10px; border:1px solid #ddd; text-align:center;">1</td>
      <td style="padding:10px; border:1px solid #ddd;">${outing.topic || '—'}</td>
      <td style="padding:10px; border:1px solid #ddd;">${outing.description?.substring(0, 140) || '—'}${outing.description?.length > 140 ? '...' : ''}</td>
      <td style="padding:10px; border:1px solid #ddd; text-align:right;">${outing.tentativeBudget ? `₹${outing.tentativeBudget.toLocaleString('en-IN')}` : '—'}</td>
      <td style="padding:10px; border:1px solid #ddd; text-align:center;">${outing.tentativeDate ? moment(outing.tentativeDate).format('DD-MMM-YYYY') : 'TBD'}</td>
      <td style="padding:10px; border:1px solid #ddd;">${outing.remark || '—'}</td>
      <td style="padding:10px; border:1px solid #ddd;">${outing.reason || '—'}</td>
    </tr>
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #7a8b2e; margin-bottom: 20px;">Outing/Event Proposal Update</h2>

      <p>Dear HR Team,</p>

      <p>The proposed outing/event <strong>${outing.topic}</strong> for the upcoming quarter, <strong>${quarterLabel}</strong>, has been reviewed by Management:</p>

      <p style="margin: 20px 0;">
        <strong>Dashboard Link:</strong>
        <a href="${dashboardLink}" style="color:#7a8b2e; font-weight:bold; text-decoration:none;">
          View & Revise Proposal →
        </a>
      </p>

      <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
        <thead>
          <tr style="background:#f4f6f2; color:#555;">
            <th style="padding:10px; border:1px solid #ddd;">S No.</th>
            <th style="padding:10px; border:1px solid #ddd;">Event/Outing Planned</th>
            <th style="padding:10px; border:1px solid #ddd;">Description</th>
            <th style="padding:10px; border:1px solid #ddd;">Tentative Budget</th>
            <th style="padding:10px; border:1px solid #ddd;">Tentative Date</th>
            <th style="padding:10px; border:1px solid #ddd;">Remark by Management</th>
            <th style="padding:10px; border:1px solid #ddd;">Remark/Reason</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p>You may revise the proposal and resubmit with necessary modifications.</p>

      <p style="margin-top:30px;">Warm regards,<br>
      <strong>Management Team</strong></p>

      <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
      <small style="color:#777; font-size:12px;">
        This is an update from the HR System.<br>
        Outing ID: ${outing._id}<br>
        Sent on ${moment().tz('Asia/Kolkata').format('MMMM DD, YYYY [at] hh:mm A z')}
      </small>
    </div>
  `;

  return {
    to: OUTING_MAIL_OVERRIDE_TO,
    cc: '',
    subject: `Outing/Event Proposal Update – ${outing.topic}`,
    body: html,
  };
}

/**
 * Automatic path — called from the PATCH /:id route when Management adds a
 * remark/reason or changes status. Manual sends (routes/outing.js's
 * /:id/mail/update/send) call sendEmail directly with the HR-edited
 * content instead of going through this gated function.
 */
async function sendOutingProposalUpdateEmail(outingId) {
  try {
    const outing = await Outing.findById(outingId).lean();
    if (!outing) {
      console.log(`Outing not found for update email: ${outingId}`);
      return { success: false, reason: 'Outing not found' };
    }

    if (!outing.reason && !outing.remark) {
      console.log(`No remark/reason on outing ${outingId} → skipping update email`);
      return { success: false, reason: 'No management remark' };
    }

    const { to, cc, subject, body } = await buildOutingProposalUpdateMail(outingId);
    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });

    if (result.success) {
      console.log(`Proposal update email sent for outing: ${outing.topic} (ID: ${outing._id})`);
    }

    return result;
  } catch (err) {
    console.error('Proposal update email failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOutingProposalUpdateEmail, buildOutingProposalUpdateMail };
