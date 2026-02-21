const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema(
    {
        employee_id: String,
        full_name: String,
        official_email: String,
        department: String,
        designation: String,
        joining_date: String,
        gender: String,
        personal_email: String,
        mobile: String,
        employee_category: String,
        level: { type: Number, enum: [1, 2, 3], default: 1 }, // for required score fetch (Level 1/2/3)
        name_of_buddy: String,

        offer_accepted_date: String,
        planned_joining_date: String,
        joining_status: String,
        exit_status: String,

        sal_applicable_from: String,
        contract_amount: String,
        contract_period_months: String,
        next_sal_review_status: String,
        next_sal_review_type: String,
        reason_for_sal_review_not_applicable: String,
        revision_due_date: String,

        basic: String,
        hra: String,
        telephone_allowance: String,
        travel_allowance: String,
        childrens_education_allowance: String,
        employer_pf: String,
        employer_esi: String,
        annual_bonus: String,
        annual_performance_incentive: String,
        medical_premium: String,
        medical_reimbursement_annual: String,
        vehicle_reimbursement_annual: String,
        driver_reimbursement_annual: String,
        telephone_reimbursement_annual: String,
        meals_reimbursement_annual: String,
        uniform_reimbursement_annual: String,
        leave_travel_allowance_annual: String,

        gross_monthly: String,
        monthly_ctc: String,
        gratuity: String,
        annual_ctc: String,
        equivalent_monthly_ctc: String,

        created_at: String,
        updated_at: String
    },
    {
        collection: 'Employee'
    }
);

module.exports = mongoose.model('Employee', EmployeeSchema);
