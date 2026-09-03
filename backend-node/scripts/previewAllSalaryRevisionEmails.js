// One-off PREVIEW script — sends one example of each of the 6 new Salary
// Revision emails to the developer only, using real data pulled from the
// database where a matching-stage record exists (and clearly-labeled
// synthetic data where none does, e.g. no 'pending_management' record
// exists yet). Nothing here mutates the database — it calls the template
// functions directly rather than the real senders/routes, so no
// escalation-sent flags or stages are touched on real records.
require('dotenv').config();

const mongoose = require('mongoose');
const SalaryRevision = require('../models/SalaryRevision');
const sendEmail = require('../emails/sendEmail');
const resolveManagerContact = require('../utils/resolveManagerContact');
const { fiscalYearOf, fiscalYearLabel } = require('../utils/fiscalQuarter');
const { MANAGER_WINDOW_DAYS, addDays } = require('../utils/salaryRevisionEscalation');

const salaryRevisionManagerRequestTemplate     = require('../emails/templates/salaryRevisionManagerRequestTemplate');
const salaryRevisionManagementApprovalTemplate = require('../emails/templates/salaryRevisionManagementApprovalTemplate');
const salaryRevisionEmployeeConfirmationTemplate = require('../emails/templates/salaryRevisionEmployeeConfirmationTemplate');
const salaryRevisionPipHoldTemplate            = require('../emails/templates/salaryRevisionPipHoldTemplate');
const salaryRevisionManagerEscalationTemplate  = require('../emails/templates/salaryRevisionManagerEscalationTemplate');
const salaryRevisionFinalEscalationTemplate    = require('../emails/templates/salaryRevisionFinalEscalationTemplate');

const RECIPIENT = 'software.developer@briskolive.com';

async function send(label, subject, html) {
  const result = await sendEmail({ to: RECIPIENT, subject: `[PREVIEW] ${subject}`, html });
  console.log(result.success ? `Sent: ${label}` : `FAILED: ${label} — ${result.error?.message || result.error}`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const pendingManager = await SalaryRevision.findOne({ stage: 'pending_manager' }).sort({ createdAt: -1 });
  const completed = await SalaryRevision.findOne({ stage: 'completed', finalIncrementPct: { $gt: 0 } }).sort({ createdAt: -1 });
  const onHold = await SalaryRevision.findOne({ stage: 'on_hold' }).sort({ createdAt: -1 });

  if (!pendingManager) console.log('No pending_manager record found — Mail 1/5/6 previews skipped.');
  if (!completed) console.log('No completed (increment) record found — Mail 3 preview skipped.');
  if (!onHold) console.log('No on_hold record found — Mail 4 preview skipped.');

  // ── Mail 1 — Manager Request ──────────────────────────────────────────
  if (pendingManager) {
    const manager = await resolveManagerContact(pendingManager);
    const priorCompleted = await SalaryRevision.findOne({
      employeeCode: pendingManager.employeeCode, stage: 'completed', _id: { $ne: pendingManager._id },
    }).sort({ applicableDate: -1, createdAt: -1 });

    const { subject, html } = salaryRevisionManagerRequestTemplate({
      managerName: manager.name,
      employeeName: pendingManager.employeeName,
      department: pendingManager.department,
      designation: pendingManager.designation,
      joiningDate: pendingManager.joiningDate,
      currentCtc: pendingManager.previousCtc,
      lastIncrementDate: priorCompleted?.applicableDate || null,
      lastIncrementPct: priorCompleted?.finalIncrementPct ?? null,
      fiscalYearLabel: fiscalYearLabel(fiscalYearOf(new Date())),
      dueDate: addDays(pendingManager.managerRequestedAt || pendingManager.createdAt, MANAGER_WINDOW_DAYS),
    });
    await send('Mail 1 — Manager Request', subject, html);

    // ── Mail 5 — Manager Escalation (synthetic due date, real employee) ──
    const escalation = salaryRevisionManagerEscalationTemplate({
      managerName: manager.name,
      employeeName: pendingManager.employeeName,
      department: pendingManager.department,
      designation: pendingManager.designation,
      joiningDate: pendingManager.joiningDate,
      currentCtc: pendingManager.previousCtc,
      dueDate: addDays(pendingManager.managerRequestedAt || pendingManager.createdAt, MANAGER_WINDOW_DAYS),
    });
    await send('Mail 5 — Manager Escalation', escalation.subject, escalation.html);

    // ── Mail 6 — Final Escalation ─────────────────────────────────────────
    const finalEscalation = salaryRevisionFinalEscalationTemplate({
      employeeName: pendingManager.employeeName,
      department: pendingManager.department,
      managerName: manager.name,
      dueDate: addDays(pendingManager.managerRequestedAt || pendingManager.createdAt, MANAGER_WINDOW_DAYS),
      pendingDays: 25,
    });
    await send('Mail 6 — Final Escalation', finalEscalation.subject, finalEscalation.html);

    // ── Mail 2 — Management Approval (synthetic managerDecision) ────────
    const approval = salaryRevisionManagementApprovalTemplate({
      employeeName: pendingManager.employeeName,
      department: pendingManager.department,
      designation: pendingManager.designation,
      joiningDate: pendingManager.joiningDate,
      currentCtc: pendingManager.previousCtc,
      managerName: manager.name,
      managerDecision: { decision: 'increment', recommendedPct: 10, reason: '[PREVIEW] Sample recommendation — no real pending_management record exists yet.' },
    });
    await send('Mail 2 — Management Approval (synthetic recommendation)', approval.subject, approval.html);
  }

  // ── Mail 3 — Employee Confirmation ──────────────────────────────────────
  if (completed) {
    const { subject, html } = salaryRevisionEmployeeConfirmationTemplate({
      employeeName: completed.employeeName,
      department: completed.department,
      designation: completed.designation,
      joiningDate: completed.joiningDate,
      previousCtc: completed.previousCtc,
      incrementPct: completed.finalIncrementPct,
      newCtc: completed.newCtc,
      effectiveFrom: completed.applicableDate,
    });
    await send('Mail 3 — Employee Confirmation', subject, html);
  }

  // ── Mail 4 — PIP Hold ────────────────────────────────────────────────────
  if (onHold) {
    const { subject, html } = salaryRevisionPipHoldTemplate({
      employeeName: onHold.employeeName,
      department: onHold.department,
      designation: onHold.designation,
      joiningDate: onHold.joiningDate,
      currentCtc: onHold.previousCtc,
      pipStartDate: onHold.managementDecision?.submittedAt || onHold.updatedAt,
      pipReviewDate: onHold.reviewDate,
    });
    await send('Mail 4 — PIP Hold', subject, html);
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
