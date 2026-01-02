from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=20,
        choices=[
            ("HR", "HR+Management"),
            ("Admin", "Admin/Tech"),
            ("Employee", "Company People"),
            ("Outsider", "Outsider"),
        ]
    )

    def __str__(self):
        return f"{self.user.username} - {self.role}"


class Country(models.Model):
    code = models.CharField(max_length=5)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "Countries"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (+{self.code})"


class State(models.Model):
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states", null=True, blank=True)

    def __str__(self):
        return f"{self.name}, {self.country.name if self.country else 'No Country'}"


class City(models.Model):
    name = models.CharField(max_length=100)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities")

    def __str__(self):
        return f"{self.name}, {self.state.name}"


class CandidateApplication(models.Model):
    full_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    whatsapp_same = models.BooleanField(default=False, blank=True)
    dob = models.CharField(max_length=20)
    state = models.CharField(max_length=50)
    city = models.CharField(max_length=100, blank=True, null=True)
    pin_code = models.CharField(max_length=6)
    relocation = models.CharField(max_length=3)  # Yes / No
    designation = models.CharField(max_length=100, blank=True, null=True)
    highest_qualification = models.TextField()
    experience = models.CharField(max_length=3)  # Yes / No
    total_experience = models.CharField(max_length=10, blank=True, null=True)
    current_ctc = models.CharField(max_length=20, blank=True, null=True)
    notice_period = models.CharField(max_length=10, blank=True, null=True)
    expected_monthly_ctc = models.CharField(max_length=20)
    hindi_read = models.CharField(max_length=20)
    hindi_write = models.CharField(max_length=20)
    hindi_speak = models.CharField(max_length=20)
    english_read = models.CharField(max_length=20)
    english_write = models.CharField(max_length=20)
    english_speak = models.CharField(max_length=20)
    facebookLink = models.URLField(blank=True, null=True)
    linkedin = models.URLField(blank=True, null=True)
    short_video_url = models.URLField(blank=True, null=True)
    resume = models.FileField(upload_to="resumes/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class JobDesignation(models.Model):
    name = models.CharField(max_length=100, unique=True)
    jd_link = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Job Designations"
        ordering = ['name']


# ==================== UPDATED EMPLOYEE & CONTRACT SYSTEM ====================

CONTRACT_TYPES = [
    ('Full-time', 'Full-time'),
    ('Part-time', 'Part-time'),
    ('Intern', 'Intern'),
    ('Temporary Staff', 'Temporary Staff'),
    ('Contract Based', 'Contract Based'),
]

class Employee(models.Model):
    employee_id = models.CharField(max_length=20, unique=True)
    full_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    department = models.CharField(max_length=50)
    designation = models.CharField(max_length=50)
    current_salary = models.DecimalField(max_digits=15, decimal_places=2, default=0)  # Updated to DecimalField
    joining_date = models.DateField()
    photo = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.full_name

    class Meta:
        ordering = ['full_name']


class Contract(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(max_length=30, choices=CONTRACT_TYPES)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=15, decimal_places=2)  # Final Annual CTC or Total Contract Amount
    is_active = models.BooleanField(default=True)

    # For Contract Based / Temporary Staff / Intern
    contract_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    contract_period_months = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.employee.full_name} - {self.get_contract_type_display()} ({self.start_date})"

    class Meta:
        ordering = ['-start_date']


# hr/models.py — Replace your ContractBreakdown model with this

class ContractBreakdown(models.Model):
    contract = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name='breakdown')

    # Core Monthly Components
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Basic Salary")
    hra = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="HRA (40% of Basic if applicable)")
    telephonic_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Telephonic Allowance")
    travel_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Travel Allowance")
    supplementary_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Supplementary Allowance")

    # Employer Contributions
    employer_pf = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Employer PF Contribution")
    employer_esic = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Employer ESIC Contribution")

    # Annual Benefits
    annual_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Annual Bonus")
    mediclaim_premium = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Mediclaim Premium (Annual)")

    # Auto-calculated fields (stored for performance & display)
    gross_monthly = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    gratuity = models.DecimalField(max_digits=12, decimal_places=2, editable=False, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CTC Breakdown - {self.contract.employee.full_name}"

    def save(self, *args, **kwargs):
        # Calculate Gross Monthly
        self.gross_monthly = (
            self.basic_salary +
            self.hra +
            self.telephonic_allowance +
            self.travel_allowance +
            self.supplementary_allowance
        )

        # Monthly CTC = Gross + PF + ESIC + (Bonus / 12)
        monthly_bonus = self.annual_bonus / 12 if self.annual_bonus else 0
        self.monthly_ctc = self.gross_monthly + self.employer_pf + self.employer_esic + monthly_bonus

        # Gratuity = 15/26 * Basic
        self.gratuity = (15 / 26) * self.basic_salary

        # Final Annual CTC → Update parent Contract.salary
        annual_ctc = (self.monthly_ctc * 12) + self.gratuity + self.mediclaim_premium

        super().save(*args, **kwargs)  # Save breakdown first

        # Update the contract's salary field
        self.contract.salary = annual_ctc
        self.contract.save(update_fields=['salary'])

    class Meta:
        verbose_name = "CTC Breakdown"
        verbose_name_plural = "CTC Breakdowns"


class Payslip(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payslips')
    month = models.CharField(max_length=20)  # e.g., "January 2026"
    file = models.FileField(upload_to="payslips/", blank=True, null=True)

    def __str__(self):
        return f"{self.employee.full_name} - {self.month}"
    
# hr/models.py — Add this new model

class SalaryStructure(models.Model):
    # Personal Info
    name = models.CharField(max_length=100, verbose_name="Name")
    gender = models.CharField(max_length=10, choices=[('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')], blank=True)
    personal_email = models.EmailField(blank=True, verbose_name="Personal Email")
    mobile = models.CharField(max_length=15, blank=True)
    official_email = models.EmailField(verbose_name="Official Email")
    dept = models.CharField(max_length=50, verbose_name="Dept")
    designation = models.CharField(max_length=50, verbose_name="Designation")
    employee_category = models.CharField(max_length=30, choices=[
        ('Full-time', 'Full-time'),
        ('Part-time', 'Part-time'),
        ('Intern', 'Intern'),
        ('Temporary Staff', 'Temporary Staff'),
        ('Contract Based', 'Contract Based'),
    ], verbose_name="Employee Category")
    name_of_buddy = models.CharField(max_length=100, blank=True, verbose_name="Name of Buddy")

    # Joining Info
    offer_accepted_date = models.DateField(null=True, blank=True)
    planned_joining_date = models.DateField(null=True, blank=True)
    joining_status = models.CharField(max_length=20, blank=True)
    exit_status = models.CharField(max_length=20, blank=True, choices=[('Active', 'Active'), ('Exited', 'Exited')], default='Active')
    joined_date = models.DateField(verbose_name="Joined Date")
    sal_applicable_from = models.DateField(verbose_name="Sal Applicable From")

    # CTC Components (Full-time)
    basic = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Basic")
    hra = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="HRA")
    travel_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Travel Allowance")
    childrens_education_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Children's Education Allowance")
    supplementary_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Supplementary Allowance")
    employer_pf = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Employer PF")
    employer_esi = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Employer ESI")
    annual_bonus = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Annual Bonus")
    annual_performance_incentive = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Annual Performance Incentive")
    medical_premium = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name="Medical Premium")

    # Annual Reimbursements
    medical_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vehicle_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    driver_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    meals_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    uniform_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    leave_travel_allowance_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Contract-based
    contract_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name="Contract Amount")
    contract_period_months = models.PositiveIntegerField(null=True, blank=True, verbose_name="Contract Period (months)")

    # Review Info
    next_sal_review_status = models.CharField(max_length=50, blank=True, verbose_name="Next Sal Review Status")
    next_sal_review_type = models.CharField(max_length=50, blank=True, verbose_name="Next Sal Review Type")
    reason_for_sal_review_not_applicable = models.TextField(blank=True, verbose_name="Reason for Sal Review Not Applicable")
    revision_due_date = models.DateField(null=True, blank=True, verbose_name="Revision Due Date")

    # Auto-calculated
    annual_ctc = models.DecimalField(max_digits=15, decimal_places=2, default=0, editable=False, verbose_name="Annual CTC")
    gross_monthly = models.DecimalField(max_digits=15, decimal_places=2, default=0, editable=False)
    monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, default=0, editable=False)
    gratuity = models.DecimalField(max_digits=15, decimal_places=2, default=0, editable=False)
    equivalent_monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, default=0, editable=False)

    def save(self, *args, **kwargs):
        # Gross Monthly
        self.gross_monthly = (
            self.basic + self.hra + self.travel_allowance +
            self.childrens_education_allowance + self.supplementary_allowance
        )

        # Monthly CTC
        monthly_bonus = self.annual_bonus / 12 if self.annual_bonus else 0
        self.monthly_ctc = self.gross_monthly + self.employer_pf + self.employer_esi + monthly_bonus

        # Gratuity
        self.gratuity = (15 / 26) * self.basic

        # Annual CTC
        self.annual_ctc = (self.monthly_ctc * 12) + self.gratuity + self.medical_premium + sum([
            self.medical_reimbursement_annual, self.vehicle_reimbursement_annual,
            self.driver_reimbursement_annual, self.telephone_reimbursement_annual,
            self.meals_reimbursement_annual, self.uniform_reimbursement_annual,
            self.leave_travel_allowance_annual, self.annual_bonus, self.annual_performance_incentive
        ])

        # Equivalent Monthly for contracts
        if self.contract_amount and self.contract_period_months:
            self.equivalent_monthly_ctc = self.contract_amount / self.contract_period_months
            self.annual_ctc = self.contract_amount  # Override for contract employees

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.employee_category} - ₹{self.annual_ctc}"

    class Meta:
        verbose_name = "Employee Salary Structure"
        verbose_name_plural = "Employee Salary Structures"