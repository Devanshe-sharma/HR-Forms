// emails/emailQuarterlyOutingApproval.js
const sendEmail = require('../emails/sendEmail');
const Outing = require('../models/Outing');
const moment = require('moment-timezone');

// Outing mail was just re-enabled (2026-10-13) — per explicit "for now all
// mails should go to only software.developer@briskolive.com" instruction,
// every real recipient below is overridden to this one test address until
// told otherwise. Remove this override (and the ones in
// emailOutingProposalUpdate.js / emailUpcomingOutingReminder.js) to restore
// normal recipients.
const OUTING_MAIL_OVERRIDE_TO = 'software.developer@briskolive.com';

// Pure builder — returns the To/CC/Subject/Body for the quarterly digest
// without sending anything, so both the automatic path and the manual
// "preview & send" UI (routes/outing.js) can reuse the exact same content.
async function buildQuarterlyOutingApprovalMail() {
  const now = moment().tz('Asia/Kolkata');
  const month = now.month() + 1;

  // Indian financial year: Apr-Jun = Q1, Jul-Sep = Q2, Oct-Dec = Q3, Jan-Mar = Q4
  // (matches the Quarter options shown in the Outing/Event filters on the frontend).
  let quarterNum;
  if (month >= 4 && month <= 6) quarterNum = 1;
  else if (month >= 7 && month <= 9) quarterNum = 2;
  else if (month >= 10 && month <= 12) quarterNum = 3;
  else quarterNum = 4;

  // FY runs Apr->Mar, so Jan-Mar belongs to the FY that started the previous April.
  const fyStartYear = month >= 4 ? now.year() : now.year() - 1;

  const quarterLabel = `Q${quarterNum} FY ${fyStartYear}-${fyStartYear + 1}`;

  // Find proposed/suggested outings
  const proposedOutings = await Outing.find({
    status: { $in: ['Proposed', 'Suggested'] }
  }).sort({ proposedAt: 1 }).lean();

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

  return {
    to: OUTING_MAIL_OVERRIDE_TO,
    cc: '',
    subject: `Outing/Event Proposal – Approval Request (${quarterLabel})`,
    body: html,
    quarterLabel,
    proposedCount: proposedOutings.length,
  };
}

/**
 * Automatic path — called from the (currently paused) quarterly cron job.
 * Manual sends (routes/outing.js's /mail/quarterly-approval/send) call
 * sendEmail directly with the HR-edited content instead.
 */
async function sendQuarterlyOutingApprovalRequest() {
  try {
    const { to, cc, subject, body, quarterLabel, proposedCount } = await buildQuarterlyOutingApprovalMail();

    if (proposedCount === 0) {
      console.log(`No proposed outings for ${quarterLabel}`);
      return { success: false, reason: 'No proposed outings' };
    }

    const result = await sendEmail({ to, cc: cc || undefined, subject, html: body });

    if (result.success) {
      console.log(`Quarterly outing approval request sent for ${quarterLabel}`);
    }

    return result;
  } catch (err) {
    console.error('Quarterly outing approval email failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Pure builder for a single outing — a lighter-weight "one event is
// awaiting your approval" notice, for the per-outing Action-column button
// (distinct from the full quarterly digest above, which batches all of them).
async function buildSingleOutingApprovalMail(outingId) {
  const outing = await Outing.findById(outingId).lean();
  if (!outing) throw new Error('Outing not found');

  const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?tab=hr`;
  const now = moment().tz('Asia/Kolkata');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #7a8b2e; margin-bottom: 20px;">Outing/Event Awaiting Your Approval</h2>

      <p>Dear Management Team,</p>

      <p>One outing/event has been recorded and is waiting for your approval:</p>

      <ul style="list-style:none; padding-left:0;">
        <li><strong>Event Title:</strong> ${outing.topic}</li>
        <li><strong>Description:</strong> ${outing.description || '—'}</li>
        <li><strong>Tentative Budget:</strong> ${outing.tentativeBudget ? `₹${outing.tentativeBudget.toLocaleString('en-IN')}` : '—'}</li>
        <li><strong>Tentative Date:</strong> ${outing.tentativeDate ? moment(outing.tentativeDate).format('DD-MMM-YYYY') : 'TBD'}</li>
      </ul>

      <p style="margin: 20px 0;">
        <strong>Dashboard Link:</strong>
        <a href="${dashboardLink}" style="color:#7a8b2e; font-weight:bold; text-decoration:none;">
          View & Approve →
        </a>
      </p>

      <p>Kindly share your approval or feedback at the earliest so that necessary arrangements can be made.</p>

      <p style="margin-top:30px;">Warm regards,<br>
      <strong>HR Team</strong></p>

      <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
      <small style="color:#777; font-size:12px;">
        Outing ID: ${outing._id}<br>
        Sent on ${now.format('MMMM DD, YYYY [at] hh:mm A z')}
      </small>
    </div>
  `;

  return {
    to: OUTING_MAIL_OVERRIDE_TO,
    cc: '',
    subject: `Outing/Event Awaiting Your Approval – ${outing.topic}`,
    body: html,
  };
}

module.exports = { sendQuarterlyOutingApprovalRequest, buildQuarterlyOutingApprovalMail, buildSingleOutingApprovalMail };