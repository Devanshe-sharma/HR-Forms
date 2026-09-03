const sendEmail = require('../sendEmail');
const SalaryRevision = require('../../models/SalaryRevision');
const Onboarding = require('../../models/onboardingModel');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { fiscalYearOf, fiscalYearLabel } = require('../../utils/fiscalQuarter');
const { MANAGER_WINDOW_DAYS, addDays } = require('../../utils/salaryRevisionEscalation');
const { computeAnchorDate, get11MonthDate, internReviewDate } = require('../../utils/salaryRevisionDueDate');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const isPpoConversion = require('../../utils/isPpoConversion');
const salaryRevisionManagerRequestTemplate = require('../templates/salaryRevisionManagerRequestTemplate');

// Live as of 2026-09-02 — sends to the real reporting manager. If no
// manager email can be resolved (no reportingHead on file, or that name
// doesn't match anyone in Onboarding), falls back to HR so the revision
// doesn't silently go unnoticed.
const HR_FALLBACK = process.env.HR_EMAIL || 'hr.manager@briskolive.com';

// Mail 1 — call right after a revision enters 'pending_manager' (fresh
// creation in POST /, or reopened after Management rejects a PIP in
// PUT /:id/management).
async function sendSalaryRevisionManagerRequest(revision) {
  const manager = await resolveManagerContact(revision);
  if (!manager.email) {
    console.error(`[sendSalaryRevisionManagerRequest] No manager email resolved for revision ${revision._id} (employee: ${revision.employeeName}, reportingHead: ${manager.name || '(none)'}) — falling back to HR.`);
  }
  const to = manager.email || HR_FALLBACK;

  const priorCompleted = await SalaryRevision.find({
    employeeCode: revision.employeeCode,
    stage: 'completed',
    _id: { $ne: revision._id },
  }).sort({ applicableDate: -1, createdAt: -1 }).lean();

  // A PPO/intern-to-employee conversion's CTC jump is a category
  // conversion (stipend to full CTC), not a real merit increment — must
  // never be shown as "Last Increment". Reported separately so the manager
  // still sees that a conversion happened, without the misleading %.
  const lastRealIncrement = priorCompleted.find((r) => !isPpoConversion(r)) || null;
  const lastPpoConversion = priorCompleted.find((r) => isPpoConversion(r)) || null;

  // The manager's deadline is always measured from the employee's actual
  // annual Reminder Date — recomputed fresh here rather than trusted from
  // whatever managerRequestedAt already holds, since that field can be
  // stale (e.g. a revision created ad-hoc, or re-sent long after the fact)
  // and drift away from the real cycle. Self-heals managerRequestedAt to
  // match, so Mail 5/6 escalation timing and the FMS score (which both
  // read managerRequestedAt directly) inherit the correction too.
  let reminderDate = revision.managerRequestedAt || revision.createdAt || new Date();
  if (revision.onboardingId) {
    const employee = await Onboarding.findById(revision.onboardingId)
      .select('joinedDate employeeCategory contractPeriod').lean();
    if (employee?.joinedDate) {
      if (employee.employeeCategory === 'Intern') {
        if (employee.contractPeriod) reminderDate = internReviewDate(employee.joinedDate, employee.contractPeriod);
      } else {
        reminderDate = get11MonthDate(computeAnchorDate(employee.joinedDate, priorCompleted));
      }
    }
  }

  if (revision.save && (!revision.managerRequestedAt || revision.managerRequestedAt.getTime() !== reminderDate.getTime())) {
    revision.managerRequestedAt = reminderDate;
    await revision.save();
  }

  const { subject, html } = salaryRevisionManagerRequestTemplate({
    managerName: manager.name,
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    currentCtc: revision.previousCtc,
    lastIncrementDate: lastRealIncrement?.applicableDate || null,
    lastIncrementPct: lastRealIncrement?.finalIncrementPct ?? null,
    ppoOfferedDate: lastPpoConversion?.fullTimeSince || lastPpoConversion?.applicableDate || null,
    ppoPreviousCtc: lastPpoConversion?.previousCtc ?? null,
    ppoNewCtc: lastPpoConversion?.newCtc ?? null,
    fiscalYearLabel: fiscalYearLabel(fiscalYearOf(new Date())),
    dueDate: addDays(reminderDate, MANAGER_WINDOW_DAYS),
    actionLink: buildSalaryRevisionActionLink(revision._id, 'manager'),
  });

  await sendEmail({ to, cc: process.env.EMAIL_MANAGEMENT, subject, html });
}

module.exports = sendSalaryRevisionManagerRequest;
