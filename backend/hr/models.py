# hr/models.py

from decimal import Decimal, InvalidOperation
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta


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
        ordering = ["name"]
        verbose_name_plural = "Countries"

    def __str__(self):
        return f"{self.name} (+{self.code})"


class State(models.Model):
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="states")

    def __str__(self):
        return self.name


class City(models.Model):
    name = models.CharField(max_length=100)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities")

    def __str__(self):
        return self.name


class CandidateApplication(models.Model):
    full_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    designation = models.CharField(max_length=100, blank=True, null=True)
    experience = models.CharField(max_length=10)
    expected_monthly_ctc = models.CharField(max_length=20)
    resume = models.FileField(upload_to="resumes/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


class JobDesignation(models.Model):
    name = models.CharField(max_length=100, unique=True)
    jd_link = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name


class Payslip(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='payslips')
    month = models.CharField(max_length=20)
    file = models.FileField(upload_to="payslips/", blank=True, null=True)

    def __str__(self):
        return f"{self.employee} - {self.month}"


# ======================================================
# Employee — All 22 CTC Components + Core Fields
# ======================================================

class Employee(models.Model):
    employee_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    official_email = models.EmailField(blank=True)
    department = models.CharField(max_length=50)
    designation = models.CharField(max_length=50)
    joining_date = models.DateField(null=True, blank=True)

    # Personal & Joining
    gender = models.CharField(max_length=10, blank=True)
    personal_email = models.EmailField(blank=True)
    mobile = models.CharField(max_length=15, blank=True)
    employee_category = models.CharField(max_length=30, null=True, blank=True)
    name_of_buddy = models.CharField(max_length=100, blank=True)
    offer_accepted_date = models.DateField(null=True, blank=True)
    planned_joining_date = models.DateField(null=True, blank=True)
    joining_status = models.CharField(max_length=20, blank=True)
    exit_status = models.CharField(max_length=20, default="Active")
    sal_applicable_from = models.DateField(null=True, blank=True)

    # Contract
    contract_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    contract_period_months = models.PositiveIntegerField(null=True, blank=True)

    # Review
    next_sal_review_status = models.CharField(max_length=50, blank=True)
    next_sal_review_type = models.CharField(max_length=50, blank=True)
    reason_for_sal_review_not_applicable = models.TextField(blank=True)
    revision_due_date = models.DateField(null=True, blank=True)

    # ==================================================
    # All 22 CTC Components (Editable + Auto-calculated)
    # ==================================================

    # CTC Core (editable)
    basic = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    hra = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    travel_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    childrens_education_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Statutory & Employer
    employer_pf = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    employer_esi = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Bonuses & Incentives (editable)
    annual_bonus = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    annual_performance_incentive = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Insurance & Premiums
    medical_premium = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Reimbursements (annual, editable)
    medical_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vehicle_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    driver_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    meals_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    uniform_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    leave_travel_allowance_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Auto-calculated fields (read-only)
    gross_monthly = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    gratuity = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    annual_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    equivalent_monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        from decimal import Decimal, InvalidOperation

        # All 22 CTC components + contract_amount
        fields_to_decimal = [
            'basic', 'hra', 'telephone_allowance', 'travel_allowance',
            'childrens_education_allowance', 'employer_pf', 'employer_esi',
            'annual_bonus', 'annual_performance_incentive', 'medical_premium',
            'medical_reimbursement_annual', 'vehicle_reimbursement_annual',
            'driver_reimbursement_annual', 'telephone_reimbursement_annual',
            'meals_reimbursement_annual', 'uniform_reimbursement_annual',
            'leave_travel_allowance_annual', 'contract_amount',
        ]

        for field in fields_to_decimal:
            val = getattr(self, field)
            if val is not None:
                if not isinstance(val, Decimal):
                    try:
                        setattr(self, field, Decimal(str(val)))
                    except (InvalidOperation, ValueError, TypeError):
                        setattr(self, field, Decimal('0.00'))

        # Calculations (safe against None/zero)
        self.gross_monthly = (
            self.basic + self.hra + self.telephone_allowance + self.travel_allowance +
            self.childrens_education_allowance
        ) or Decimal('0.00')

        monthly_bonus = (self.annual_bonus / Decimal('12')) if self.annual_bonus else Decimal('0.00')

        self.monthly_ctc = (
            self.gross_monthly + self.employer_pf + self.employer_esi + monthly_bonus
        ) or Decimal('0.00')

        self.gratuity = (self.basic * Decimal('15') / Decimal('26')) if self.basic else Decimal('0.00')

        self.annual_ctc = (
            self.monthly_ctc * Decimal('12') +
            self.gratuity +
            self.medical_premium +
            self.medical_reimbursement_annual +
            self.vehicle_reimbursement_annual +
            self.driver_reimbursement_annual +
            self.telephone_reimbursement_annual +
            self.meals_reimbursement_annual +
            self.uniform_reimbursement_annual +
            self.leave_travel_allowance_annual +
            self.annual_bonus +
            self.annual_performance_incentive
        ) or Decimal('0.00')

        if self.contract_amount and self.contract_period_months:
            self.equivalent_monthly_ctc = self.contract_amount / Decimal(self.contract_period_months)
            self.annual_ctc = self.contract_amount
        else:
            self.equivalent_monthly_ctc = Decimal('0.00')

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id or 'No ID'} - {self.full_name}"


class CTCComponent(models.Model):
    """
    Master list of all CTC components — fully managed by HR
    """
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=50, unique=True)
    formula = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    show_in_documents = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='ctc_components')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "CTC Component"
        verbose_name_plural = "CTC Components"

    def __str__(self):
        return f"{self.name} ({self.code})"


class Contract(models.Model):
    """
    One salary revision / contract per employee
    """
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='contracts')
    effective_from = models.DateField(help_text="Salary applicable from this date")
    total_annual_ctc = models.DecimalField(max_digits=16, decimal_places=2, help_text="Annual CTC entered by HR")
    
    breakdown = models.JSONField(default=dict, help_text="Key = component code, Value = amount (annual)")
    manual_overrides = models.JSONField(default=dict, blank=True, help_text="e.g., {'TELEPHONE': 2000}")
    
    contract_period_months = models.PositiveIntegerField(null=True, blank=True)
    contract_amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    
    next_review_status = models.CharField(max_length=50, default="Due")
    next_review_type = models.CharField(max_length=50, default="Annual")
    reason_not_applicable = models.TextField(blank=True)
    revision_due_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_from']
        unique_together = ['employee', 'effective_from']

    def __str__(self):
        return f"{self.employee.full_name} - CTC ₹{self.total_annual_ctc} from {self.effective_from}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    mobile = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.mobile}"


class OTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    def __str__(self):
        return f"OTP {self.otp} for {self.user.username}"
    

# ────────────────────────────────────────────────────────────────
# Department Master (supports hierarchy + type Delivery/Support)
# ────────────────────────────────────────────────────────────────

class Department(models.Model):
    DEPARTMENT_TYPE_CHOICES = [
        ('Delivery', 'Delivery'),
        ('Support', 'Support'),
    ]

    name = models.CharField(max_length=120, unique=True, verbose_name="Department Name")
    dept_page_link = models.URLField(max_length=500, blank=True, null=True,
                                     verbose_name="Department Page Link (BO Internal)")
    dept_head_email = models.EmailField(blank=True, null=True, verbose_name="Department Head Email")
    dept_group_email = models.EmailField(blank=True, null=True, verbose_name="Department Group Email")
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name="Parent Department"
    )
    department_type = models.CharField(
        max_length=20,
        choices=DEPARTMENT_TYPE_CHOICES,
        default='Delivery'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Department"
        verbose_name_plural = "Departments"

    def __str__(self):
        return self.name

    def get_hierarchy(self):
        path = [self.name]
        current = self.parent
        while current:
            path.append(current.name)
            current = current.parent
        return " → ".join(reversed(path))


# ────────────────────────────────────────────────────────────────
# Designation Master (linked to Department)
# ────────────────────────────────────────────────────────────────

class Designation(models.Model):
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='designations'
    )
    name = models.CharField(max_length=120, verbose_name="Designation")
    role_document_link = models.URLField(max_length=500, blank=True, null=True,
                                         verbose_name="Role Document Link")
    jd_link = models.URLField(max_length=500, blank=True, null=True,
                              verbose_name="Job Description (JD) Link")
    remarks = models.TextField(blank=True, null=True)
    role_document_text = models.TextField(
        blank=True,
        null=True,
        verbose_name="Role Document Content (text fallback)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department', 'name']
        unique_together = [['department', 'name']]
        verbose_name = "Designation"
        verbose_name_plural = "Designations"

    def __str__(self):
        return f"{self.name} • {self.department.name}"