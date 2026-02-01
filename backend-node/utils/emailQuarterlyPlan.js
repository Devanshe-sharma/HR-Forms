const sendEmail = require('./sendEmail');
const Training = require('../models/Training');
const moment = require('moment-timezone');

/**
 * Sends Quarterly Training Plan Approval Request
 * - Runs daily at 9–10 AM IST (randomized within window)
 * - Only sends on 1st of Mar, Jun, Sep, Dec
 * - Shows only "Proposed" / "Under Review" trainings
 */
async function sendQuarterlyApprovalRequest() {
  try {
    const now = moment().tz('Asia/Kolkata');
    const day = now.date();           // 1–31
    const month = now.month() + 1;    // 1–12

    // Only proceed on 1st of March, June, September, December
    // if (day !== 1 || ![3, 6, 9, 12].includes(month)) {
    //   console.log(`[${now.format('YYYY-MM-DD HH:mm:ss')}] Not a quarterly send day. Skipping.`);
    //   return { success: false, reason: 'Not send day' };
    // }

    // Determine upcoming quarter
    let quarterNum, fyStartYear;
    if (month === 3) { quarterNum = 1; fyStartYear = now.year(); }
    else if (month === 6) { quarterNum = 2; fyStartYear = now.year(); }
    else if (month === 9) { quarterNum = 3; fyStartYear = now.year(); }
    else { quarterNum = 4; fyStartYear = now.year() - 1; }

    const quarterLabel = `Q${quarterNum} FY ${fyStartYear}-${fyStartYear + 1}`;

    // Fetch proposed trainings (you can add quarter/financialYear filter if already populated)
    // If quarter & financialYear are reliably stored → use them:
    const proposedTrainings = await Training.find({
      status: { $in: ['Proposed', 'Under Review', ] },
      // Optional: uncomment if you want strict filter
      // quarter: `Q${quarterNum}`,
      // financialYear: `FY ${fyStartYear}-${fyStartYear + 1}`
    })
      .sort({ createdAt: 1 }) // or priority/trainingDate if you want
      .lean(); // faster, plain JS objects

    if (proposedTrainings.length === 0) {
      console.log(`No proposed trainings found for ${quarterLabel}`);
      return { success: false, reason: 'No proposed trainings' };
    }

    // Build clean HTML table (NO Priority column)
    let tableRows = '';
    proposedTrainings.forEach((t, index) => {
      tableRows += `
        <tr>
          <td style="padding:10px; border:1px solid #ddd; text-align:center;">${index + 1}</td>
          <td style="padding:10px; border:1px solid #ddd;">${t.topic || '—'}</td>
          <td style="padding:10px; border:1px solid #ddd;">${t.description?.substring(0, 140) || '—'}${t.description?.length > 140 ? '...' : ''}</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:center;">${t.trainer?.name || 'TBD'}</td>
          <td style="padding:10px; border:1px solid #ddd; text-align:center;">${t.trainingDate ? new Date(t.trainingDate).toLocaleDateString('en-IN') : 'TBD'}</td>
        </tr>
      `;
    });

    const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/training-page?tab=management`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
        <h2 style="color: #7a8b2e;">Quarterly Training Plan – Approval Request</h2>
        <p>Dear Management Team,</p>
        <p>As part of our quarterly learning and development initiative, the HR team has prepared the proposed training plan for the upcoming quarter, <strong>${quarterLabel}</strong>.</p>
        
        <p>Below are the key details:</p>
        <p><strong>Dashboard Link:</strong> 
          <a href="${dashboardLink}" style="color:#7a8b2e; font-weight:bold; text-decoration:none;">View Full Plan & Approve →</a>
        </p>

        <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
          <thead>
            <tr style="background:#f4f6f2; color:#555;">
              <th style="padding:10px; border:1px solid #ddd;">S No.</th>
              <th style="padding:10px; border:1px solid #ddd;">Training Topic</th>
              <th style="padding:10px; border:1px solid #ddd;">Description</th>
              <th style="padding:10px; border:1px solid #ddd;">Trainer Name (tentative)</th>
              <th style="padding:10px; border:1px solid #ddd;">Tentative Date</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p>We request your review and approval of the proposed trainings. Once approved, the sessions will be formally scheduled and communicated to all stakeholders.</p>
        
        <p>Warm regards,<br>
        <strong>HR Team</strong></p>

        <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
        <small style="color:#777; font-size:12px;">
          This is an automated message from the HR Training System.<br>
          Sent on ${now.format('MMMM DD, YYYY [at] hh:mm A z')}
        </small>
      </div>
    `;

    const result = await sendEmail({
      to: process.env.EMAIL_MANAGEMENT,
      cc: process.env.EMAIL_HR,
      subject: `Quarterly Training Plan – Approval Request (${quarterLabel})`,
      html,
    });

    if (result.success) {
      console.log(`Quarterly approval request sent successfully for ${quarterLabel}`);
    }

    return result;
  } catch (err) {
    console.error('Quarterly approval email failed:', err.message);
    return { success: false, error: err.message };
  }
}
(async () => {
  console.log('=== FORCING QUARTERLY APPROVAL EMAIL TEST ===');
  const result = await sendQuarterlyApprovalRequest();
  console.log('Test result:', result);
})();

module.exports = { sendQuarterlyApprovalRequest };