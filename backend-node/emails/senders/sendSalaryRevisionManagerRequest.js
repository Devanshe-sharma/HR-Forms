const sendEmail = require('../sendEmail');
const SalaryRevision = require('../../models/SalaryRevision');
const resolveManagerContact = require('../../utils/resolveManagerContact');
const { fiscalYearOf, fiscalYearLabel } = require('../../utils/fiscalQuarter');
const { RESPONSE_DAYS, addDays } = require('../../utils/salaryRevisionEscalation');
const { buildSalaryRevisionActionLink } = require('../../utils/salaryRevisionMailSigning');
const salaryRevisionManagerRequestTemplate = require('../templates/salaryRevisionManagerRequestTemplate');

// TODO: recipient is routed to the developer only, per explicit instruction,
// until the real send to reporting managers is approved — see
// sendSalaryRevisionDue.js for the same convention on the existing digest.
const RECIPIENT = 'software.developer@briskolive.com';

// Mail 1 — call right after a revision enters 'pending_manager' (fresh
// creation in POST /, or reopened after Management rejects a PIP in
// PUT /:id/management).
async function sendSalaryRevisionManagerRequest(revision) {
  const manager = await resolveManagerContact(revision);

  const priorCompleted = await SalaryRevision.find({
    employeeCode: revision.employeeCode,
    stage: 'completed',
    _id: { $ne: revision._id },
  }).sort({ applicableDate: -1, createdAt: -1 }).limit(1).lean();
  const lastRevision = priorCompleted[0] || null;

  const { subject, html } = salaryRevisionManagerRequestTemplate({
    managerName: manager.name,
    employeeName: revision.employeeName,
    department: revision.department,
    designation: revision.designation,
    joiningDate: revision.joiningDate,
    currentCtc: revision.previousCtc,
    lastIncrementDate: lastRevision?.applicableDate || null,
    lastIncrementPct: lastRevision?.finalIncrementPct ?? null,
    fiscalYearLabel: fiscalYearLabel(fiscalYearOf(new Date())),
    dueDate: addDays(revision.managerRequestedAt || revision.createdAt || new Date(), RESPONSE_DAYS),
    actionLink: buildSalaryRevisionActionLink(revision._id, 'manager'),
  });

  await sendEmail({ to: RECIPIENT, subject, html });
}

module.exports = sendSalaryRevisionManagerRequest;
