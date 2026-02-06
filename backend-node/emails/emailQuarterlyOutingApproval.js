// emails/emailQuarterlyOutingApproval.js
const sendEmail = require('../emails/sendEmail');
const Outing = require('../models/Outing');
const moment = require('moment-timezone');

async function sendQuarterlyOutingApprovalRequest() {
  try {
    const now = moment().tz('Asia/Kolkata');
    const day = now.date();
    const month = now.month() + 1;

    // Only run on 1st of Mar, Jun, Sep, Dec
    // if (day !== 1 || ![3, 6, 9, 12].includes(month)) {
    //   console.log(`[${now.format('YYYY-MM-DD HH:mm:ss z')}] Not a quarterly send day. Skipping.`);
    //   return { success: false, reason: 'Not send day' };
    // }

    // Determine quarter
    let quarterNum, fyStartYear;
    if (month === 3) { quarterNum = 1; fyStartYear = now.year(); }
    else if (month === 6) { quarterNum = 2; fyStartYear = now.year(); }
    else if (month === 9) { quarterNum = 3; fyStartYear = now.year(); }
    else { quarterNum = 4; fyStartYear = now.year(); }

    const quarterLabel = `Q${quarterNum} FY ${fyStartYear}-${fyStartYear + 1}`;

    // Find proposed/suggested outings
    const proposedOutings = await Outing.find({
      status: { $in: ['Proposed', 'Suggested'] }
    }).sort({ proposedAt: 1 }).lean();

    if (proposedOutings.length === 0) {
      console.log(`No proposed outings for ${quarterLabel}`);
      return { success: false, reason: 'No proposed outings' };
    }

    // Build table rows
    let tableRows = '';
        proposedOutings.forEach((o, index) => {
        const desc = o.description || '—';
        const shortDesc = desc.length > 140 ? desc.substring(0, 140) + '...' : desc;

        tableRows += `
            <tr>
            <td style="padding:10px; border:1px solid #ddd; text-align:center;">${index + 1}</td>
            <td style="padding:10px; border:1px solid #ddd;">${o.topic || '—'}</td>
            <td style="padding:10px; border:1px solid #ddd;">${shortDesc}</td>
            <td style="padding:10px; border:1px solid #ddd; text-align:right;">${o.tentativeBudget ? `₹${o.tentativeBudget.toLocaleString('en-IN')}` : '—'}</td>
            <td style="padding:10px; border:1px solid #ddd; text-align:center;">${o.tentativeDate ? moment(o.tentativeDate).format('DD-MMM-YYYY') : 'TBD'}</td>
            </tr>
        `;
        });

    const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?tab=hr`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
        <h2 style="color: #7a8b2e; margin-bottom: 20px;">Outing/Event Proposal – Approval Request</h2>
        
        <p>Dear Management Team,</p>
        
        <p>As part of our quarterly engagement and wellness initiative, the HR team has prepared the proposed Outing/Event plan for the upcoming quarter, <strong>${quarterLabel}</strong>.</p>
        
        <p>Below are the key details:</p>
        
        <p style="margin: 20px 0;">
          <strong>Dashboard Link:</strong> 
          <a href="${dashboardLink}" style="color:#7a8b2e; font-weight:bold; text-decoration:none;">
            View Full Plan & Approve →
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
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p>We request your review and approval to proceed with scheduling.</p>
        <p>Kindly share your approval or feedback at the earliest so that necessary arrangements can be made.</p>
        
        <p style="margin-top:30px;">Warm regards,<br>
        <strong>HR Team</strong></p>

        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
        <small style="color:#777; font-size:12px;">
          This is an automated message from the HR System.<br>
          Sent on ${now.format('MMMM DD, YYYY [at] hh:mm A z')}
        </small>
      </div>
    `;

    const result = await sendEmail({
      to: process.env.EMAIL_MANAGEMENT,
      cc: process.env.EMAIL_HR,
      subject: `Outing/Event Proposal – Approval Request (${quarterLabel})`,
      html,
    });

    if (result.success) {
      console.log(`Quarterly outing approval request sent for ${quarterLabel}`);
    }

    return result;
  } catch (err) {
    console.error('Quarterly outing approval email failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendQuarterlyOutingApprovalRequest };