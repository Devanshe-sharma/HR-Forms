const Onboarding = require('../models/onboardingModel');

// Same "active" definition as utils/employeeMaster.js's is_current: joined,
// and not exited.
const EXITED_STATUS_VALUES = ['Left', 'Already Left'];
const ACTIVE_FILTER = { joiningStatus: 'Joined', exitStatus: { $nin: EXITED_STATUS_VALUES } };

// Salary Structure section of the Onboarding schema only (models/onboardingModel.js) —
// no contact info, personal details, documents, etc. empId/name are kept
// only as the minimal identifier needed to tell rows apart.
const SALARY_PROJECTION = [
  'empId', 'name', 'officialEmail', 'mobile', 'dept', 'designation',
  'annualCtc', 'basicSal', 'hraSal', 'travelAllowance', 'childrenEducationAllowance',
  'supplementaryAllowance', 'grossMonthly', 'empEpf', 'empEsic', 'monthlyCtc',
  'medicalReimbursement', 'vehicleReimbursement', 'driverReimbursement', 'telephoneReimbursement',
  'mealsReimbursement', 'uniformReimbursement', 'leaveTravelAllowance',
  'annualBonus', 'annualPerformanceIncentive', 'medicalPremium', 'gratuity',
  'contractAmount', 'contractPeriod', 'equivalentMonthlyCtc',
].join(' ');

/**
 * Salary-only view of every ACTIVE (joined, not exited) Onboarding record,
 * keyed by employee_id — used by the external (API-key-gated) salary API.
 * Deliberately excludes every non-salary field (name is kept only as a
 * human-readable label alongside the key, not as identifying/contact data).
 */
async function getEmployeeSalaryList() {
  const docs = await Onboarding.find(ACTIVE_FILTER, SALARY_PROJECTION).lean();

  return docs.map((d) => ({
    employee_id: d.empId || String(d._id),
    full_name: d.name || '',
    official_email: d.officialEmail || '',
    mobile: d.mobile || '',
    department: d.dept || '',
    designation: d.designation || '',
    annual_ctc: d.annualCtc ?? null,
    basic: d.basicSal ?? null,
    hra: d.hraSal ?? null,
    travel_allowance: d.travelAllowance ?? null,
    children_education_allowance: d.childrenEducationAllowance ?? null,
    supplementary_allowance: d.supplementaryAllowance ?? null,
    gross_monthly: d.grossMonthly ?? null,
    employer_pf: d.empEpf ?? null,
    employer_esic: d.empEsic ?? null,
    monthly_ctc: d.monthlyCtc ?? null,
    medical_reimbursement_annual: d.medicalReimbursement ?? null,
    vehicle_reimbursement_annual: d.vehicleReimbursement ?? null,
    driver_reimbursement_annual: d.driverReimbursement ?? null,
    telephone_reimbursement_annual: d.telephoneReimbursement ?? null,
    meals_reimbursement_annual: d.mealsReimbursement ?? null,
    uniform_reimbursement_annual: d.uniformReimbursement ?? null,
    leave_travel_allowance_annual: d.leaveTravelAllowance ?? null,
    annual_bonus: d.annualBonus ?? null,
    annual_performance_incentive: d.annualPerformanceIncentive ?? null,
    medical_premium: d.medicalPremium ?? null,
    gratuity: d.gratuity ?? null,
    contract_amount: d.contractAmount ?? null,
    contract_period_months: d.contractPeriod ?? null,
    equivalent_monthly_ctc: d.equivalentMonthlyCtc ?? null,
  }));
}

module.exports = { getEmployeeSalaryList };
