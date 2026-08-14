// One-off TEST script — previews the "Salary Revision review due this
// month" list as a single digest email, sent ONLY to the developer
// (never to actual managers/HR/CC) so the data + email pipeline can be
// verified before any real trigger/cron is wired up.
require('dotenv').config();

const mongoose = require('mongoose');
const Onboarding = require('../models/onboardingModel');
const sendEmail = require('../emails/sendEmail');

const TEST_RECIPIENT = 'software.developer@briskolive.com';
const EXITED_STATUS_VALUES = ['Left', 'Already Left'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCtc(n) {
  return n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthLabel = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const employees = await Onboarding.find({
    nextPerformanceReviewDate: { $gte: monthStart, $lt: monthEnd },
    joiningStatus: 'Joined',
    exitStatus: { $nin: EXITED_STATUS_VALUES },
  })
    .select('name dept designation reportingHead joinedDate annualCtc salApplicableFrom nextPerformanceReviewDate officialEmail empId')
    .lean();

  console.log(`Found ${employees.length} employee(s) with review due in ${monthLabel}`);
  employees.forEach((e) => console.log(`  - ${e.name} (${e.dept} / ${e.designation}) — review: ${fmtDate(e.nextPerformanceReviewDate)}`));

  const rows = employees.map((e) => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${e.name || '—'}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${e.dept || '—'}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${e.designation || '—'}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${e.reportingHead || '—'}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${fmtDate(e.joinedDate)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${fmtCtc(e.annualCtc)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${fmtDate(e.salApplicableFrom)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${fmtDate(e.nextPerformanceReviewDate)}</td>
    </tr>
  `).join('');

  const html = `
    <p>This is a <b>TEST</b> preview of employees whose salary revision review is due in <b>${monthLabel}</b>.</p>
    <p style="color:#b91c1c;"><b>Sent to you only — no managers, HR, or CC recipients were emailed.</b> This is just to verify the data/email pipeline before real triggers go live.</p>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Employee</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Department</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Designation</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Reporting Manager</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Date of Joining</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Current CTC</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Last Increment Date</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Next Review Date</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8" style="padding:8px;border:1px solid #e2e8f0;">No employees due this month.</td></tr>'}</tbody>
    </table>
  `;

  const result = await sendEmail({
    to: TEST_RECIPIENT,
    subject: `[TEST] Salary Revision — Review Due This Month (${employees.length}) — ${monthLabel}`,
    html,
  });

  if (result.success) {
    console.log(`\nTest email sent to ${TEST_RECIPIENT}. Message ID: ${result.messageId}`);
  } else {
    console.error(`\nTest email FAILED: ${result.error?.message || result.error}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Script failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
