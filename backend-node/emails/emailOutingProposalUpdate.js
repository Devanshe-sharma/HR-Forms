const sendEmail = require('../emails/sendEmail');
const Outing = require('../models/Outing');
const moment = require('moment-timezone');

/**
 * Sends update email to HR when Management adds remark/reason or changes status
 * @param {String} outingId - ID of the updated outing
 */
async function sendOutingProposalUpdateEmail(outingId) {
  try {
    const outing = await Outing.findById(outingId).lean();
    if (!outing) {
      console.log(`Outing not found for update email: ${outingId}`);
      return { success: false, reason: 'Outing not found' };
    }

    // Only send if Management made changes (has remark or status changed)
    if (!outing.reason && !outing.remark) {
      console.log(`No remark/reason on outing ${outingId} → skipping update email`);
      return { success: false, reason: 'No management remark' };
    }

    const quarterLabel = outing.quarter && outing.financialYear 
      ? `${outing.quarter} ${outing.financialYear}` 
      : 'Upcoming Quarter';

    const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?tab=hr`;

    // Build table (single row since it's one updated proposal)
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
          This is an automated update from the HR System.<br>
          Outing ID: ${outing._id}<br>
          Sent on ${moment().tz('Asia/Kolkata').format('MMMM DD, YYYY [at] hh:mm A z')}
        </small>
      </div>
    `;

    const result = await sendEmail({
      to: process.env.EMAIL_HR,
      cc: process.env.EMAIL_MANAGEMENT,
      subject: `Outing/Event Proposal Update – ${outing.topic}`,
      html,
    });

    if (result.success) {
      console.log(`Proposal update email sent for outing: ${outing.topic} (ID: ${outing._id})`);
    }

    return result;
  } catch (err) {
    console.error('Proposal update email failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOutingProposalUpdateEmail };