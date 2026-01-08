# hr/models.py

from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import datetime


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
# Employee — All 42 Salary Fields Here
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

    # CTC Core
    basic = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    hra = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    travel_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    childrens_education_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    supplementary_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    employer_pf = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    employer_esi = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    annual_bonus = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    annual_performance_incentive = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    medical_premium = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Reimbursements
    medical_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vehicle_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    driver_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    meals_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    uniform_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    leave_travel_allowance_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Contract
    contract_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    contract_period_months = models.PositiveIntegerField(null=True, blank=True)

    # Review
    next_sal_review_status = models.CharField(max_length=50, blank=True)
    next_sal_review_type = models.CharField(max_length=50, blank=True)
    reason_for_sal_review_not_applicable = models.TextField(blank=True)
    revision_due_date = models.DateField(null=True, blank=True)

    # Auto-calculated
    gross_monthly = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    gratuity = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    annual_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    equivalent_monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        from decimal import Decimal

        # Convert any non-Decimal values to Decimal
        fields_to_decimal = [
            'basic', 'hra','telephone_allowance' 'travel_allowance', 'childrens_education_allowance', 'supplementary_allowance',
            'employer_pf', 'employer_esi', 'annual_bonus', 'annual_performance_incentive',
            'medical_premium', 'medical_reimbursement_annual', 'vehicle_reimbursement_annual',
            'driver_reimbursement_annual', 'telephone_reimbursement_annual', 'meals_reimbursement_annual',
            'uniform_reimbursement_annual', 'leave_travel_allowance_annual', 'contract_amount',
        ]
        for field in fields_to_decimal:
            val = getattr(self, field)
            if val is not None and not isinstance(val, Decimal):
                setattr(self, field, Decimal(str(val)))

        # Calculations
        self.gross_monthly = (
            self.basic + self.hra + self.telephone_allowance + self.travel_allowance +
            self.childrens_education_allowance + self.supplementary_allowance
        )

        monthly_bonus = self.annual_bonus / Decimal('12') if self.annual_bonus else Decimal('0')

        self.monthly_ctc = self.gross_monthly + self.employer_pf + self.employer_esi + monthly_bonus

        self.gratuity = self.basic * Decimal('15') / Decimal('26')

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
        )

        if self.contract_amount and self.contract_period_months:
            self.equivalent_monthly_ctc = self.contract_amount / Decimal(self.contract_period_months)
            self.annual_ctc = self.contract_amount
        else:
            self.equivalent_monthly_ctc = Decimal('0')

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee_id or 'No ID'} - {self.full_name}"


class CTCComponent(models.Model):
    """
    Master list of all CTC components — fully managed by HR
    """
    name = models.CharField(max_length=150, unique=True)          # e.g., "House Rent Allowance"
    code = models.CharField(max_length=50, unique=True)           # e.g., "HRA" — used in formulas (uppercase, no spaces)
    formula = models.TextField(blank=True, null=True)              # e.g., "BASIC * 0.4" or "500" or "IF(GROSS_MONTHLY < 21000, GROSS_MONTHLY * 0.0325, 0)"
    order = models.PositiveIntegerField(default=0)                # Display order
    is_active = models.BooleanField(default=True)                 # Soft delete
    show_in_documents = models.BooleanField(default=True)         # Appear in offer letter, payslip, etc.
    notes = models.TextField(blank=True)                          # Optional description for HR
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
    
    # All calculated values stored here — fully dynamic
    breakdown = models.JSONField(default=dict, help_text="Key = component code, Value = amount (annual unless specified)")
    
    # Optional manual overrides (for special cases)
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

# User Profile for mobile number (used in forgot password)
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    mobile = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.mobile}"


# OTP for password reset
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