# hr/models.py
from decimal import Decimal, InvalidOperation
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from django.contrib.postgres.fields import ArrayField


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

    class Meta:
        unique_together = ['name', 'country']
        ordering = ['name']

    def __str__(self):
        return self.name


class City(models.Model):
    name = models.CharField(max_length=100)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="cities")

    class Meta:
        unique_together = ['name', 'state']
        ordering = ['name']

    def __str__(self):
        return f"{self.name}, {self.state.name}"


class CandidateApplication(models.Model):
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)

    whatsapp_same = models.BooleanField(default=False, null=True, blank=True)      # ← must have this
    dob           = models.DateField(null=True, blank=True)

    state = models.ForeignKey(State, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidate_applications')
    city  = models.ForeignKey(City,  on_delete=models.SET_NULL, null=True, blank=True, related_name='candidate_applications')

    pin_code = models.CharField(max_length=6, blank=True, null=True)

    relocation = models.CharField(max_length=3, choices=[("Yes", "Yes"), ("No", "No")], default="Yes")

    designation          = models.CharField(max_length=100, blank=True, null=True)
    highest_qualification = models.CharField(max_length=100, blank=True, null=True)

    experience = models.CharField(max_length=3, choices=[("Yes", "Yes"), ("No", "No")], default="No")

    total_experience     = models.CharField(max_length=50, blank=True, null=True)
    current_ctc          = models.CharField(max_length=50, blank=True, null=True)
    notice_period        = models.CharField(max_length=50, blank=True, null=True)
    expected_monthly_ctc = models.CharField(max_length=50, blank=True, null=True)  # ← also make nullable

    hindi_read   = models.CharField(max_length=20, blank=True, null=True)
    hindi_write  = models.CharField(max_length=20, blank=True, null=True)
    hindi_speak  = models.CharField(max_length=20, blank=True, null=True)
    english_read   = models.CharField(max_length=20, blank=True, null=True)
    english_write  = models.CharField(max_length=20, blank=True, null=True)
    english_speak  = models.CharField(max_length=20, blank=True, null=True)

    facebookLink     = models.URLField(blank=True, default='')
    linkedin         = models.URLField(blank=True, default='')
    short_video_url  = models.URLField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    STATUS_CHOICES = [
        ('Applied', 'Applied'),
        ('Shortlisted', 'Shortlisted'),
        ('Rejected', 'Rejected'),
        ('1st', '1st'),
        ('2nd', '2nd'),
        ('3rd', '3rd'),
        ('Final Interview Round', 'Final Interview Round'),
        ('Selected', 'Selected'),
        ('Offer Letter Sent', 'Offer Letter Sent'),
        ('Offer Letter Accepted', 'Offer Letter Accepted'),
        ('Offer Letter Accepted But Not Joined', 'Offer Letter Accepted But Not Joined'),
        ('Joined', 'Joined'),
    ]

    status = models.CharField(
        max_length=50, 
        choices=STATUS_CHOICES, 
        default='Applied'
    )

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


class Employee(models.Model):
    employee_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    official_email = models.EmailField(blank=True)
    department = models.CharField(max_length=50)
    designation = models.CharField(max_length=50)
    joining_date = models.DateField(null=True, blank=True)

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

    contract_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    contract_period_months = models.PositiveIntegerField(null=True, blank=True)

    next_sal_review_status = models.CharField(max_length=50, blank=True)
    next_sal_review_type = models.CharField(max_length=50, blank=True)
    reason_for_sal_review_not_applicable = models.TextField(blank=True)
    revision_due_date = models.DateField(null=True, blank=True)

    # CTC Components
    basic = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    hra = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    travel_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    childrens_education_allowance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    employer_pf = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    employer_esi = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    annual_bonus = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    annual_performance_incentive = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    medical_premium = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    medical_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vehicle_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    driver_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    telephone_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    meals_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    uniform_reimbursement_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    leave_travel_allowance_annual = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Auto-calculated
    gross_monthly = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    gratuity = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    annual_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)
    equivalent_monthly_ctc = models.DecimalField(max_digits=15, decimal_places=2, editable=False, default=0)

    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,        
        blank=True          
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        null=True,         
        blank=True
    )
    def save(self, *args, **kwargs):
        # Convert string inputs to Decimal safely
        decimal_fields = [
            'basic', 'hra', 'telephone_allowance', 'travel_allowance',
            'childrens_education_allowance', 'employer_pf', 'employer_esi',
            'annual_bonus', 'annual_performance_incentive', 'medical_premium',
            'medical_reimbursement_annual', 'vehicle_reimbursement_annual',
            'driver_reimbursement_annual', 'telephone_reimbursement_annual',
            'meals_reimbursement_annual', 'uniform_reimbursement_annual',
            'leave_travel_allowance_annual', 'contract_amount',
        ]

        for field in decimal_fields:
            val = getattr(self, field)
            if val is not None and val != '':
                try:
                    setattr(self, field, Decimal(str(val)))
                except (InvalidOperation, ValueError):
                    setattr(self, field, Decimal('0.00'))

        # Calculations
        self.gross_monthly = (
            self.basic + self.hra + self.telephone_allowance +
            self.travel_allowance + self.childrens_education_allowance
        )

        monthly_bonus = (self.annual_bonus / Decimal('12')) if self.annual_bonus else Decimal('0')
        self.monthly_ctc = self.gross_monthly + self.employer_pf + self.employer_esi + monthly_bonus

        self.gratuity = (self.basic * Decimal('15') / Decimal('26')) if self.basic else Decimal('0')

        self.annual_ctc = (
            self.monthly_ctc * Decimal('12') +
            self.gratuity + self.medical_premium +
            sum([
                self.medical_reimbursement_annual,
                self.vehicle_reimbursement_annual,
                self.driver_reimbursement_annual,
                self.telephone_reimbursement_annual,
                self.meals_reimbursement_annual,
                self.uniform_reimbursement_annual,
                self.leave_travel_allowance_annual,
                self.annual_bonus,
                self.annual_performance_incentive,
            ])
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

    def __str__(self):
        return f"{self.name} ({self.code})"


class Contract(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='contracts')
    effective_from = models.DateField()
    total_annual_ctc = models.DecimalField(max_digits=16, decimal_places=2)
    breakdown = models.JSONField(default=dict)
    manual_overrides = models.JSONField(default=dict, blank=True)
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
        return f"{self.employee.full_name} - ₹{self.total_annual_ctc} from {self.effective_from}"


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

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    def __str__(self):
        return f"OTP {self.otp} for {self.user.username}"


class Department(models.Model):
    DEPARTMENT_TYPE_CHOICES = [('Delivery', 'Delivery'), ('Support', 'Support')]

    name = models.CharField(max_length=120, unique=True)
    dept_page_link = models.URLField(max_length=500, blank=True, null=True)
    dept_head_email = models.EmailField(blank=True, null=True)
    dept_group_email = models.EmailField(blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    department_type = models.CharField(max_length=20, choices=DEPARTMENT_TYPE_CHOICES, default='Delivery')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_hierarchy(self):
        path = [self.name]
        current = self.parent
        while current:
            path.append(current.name)
            current = current.parent
        return " → ".join(reversed(path))


class Designation(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='designations')
    name = models.CharField(max_length=120)
    role_document_link = models.URLField(max_length=500, blank=True, null=True)
    jd_link = models.URLField(max_length=500, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    role_document_text = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department', 'name']
        unique_together = [['department', 'name']]

    def __str__(self):
        return f"{self.name} • {self.department.name}"


class HiringRequisition(models.Model):
    # Auto-generated serial number (HR-YYYYMM-XXX)
    ser = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="Serial No"
    )

    # Requester Details
    request_date = models.DateField(
        auto_now_add=True,
        verbose_name="Request Date"
    )
    requisitioner_name = models.CharField(
        max_length=255,
        verbose_name="Requisitioner Name"
    )
    requisitioner_email = models.EmailField(
        blank=True,
        null=True,
        verbose_name="Requisitioner Email"
    )

    # Position to Hire
    hiring_dept = models.CharField(
        max_length=255,
        verbose_name="Hiring Department"
    )
    hiring_dept_email = models.EmailField(
        blank=True,
        null=True,
        verbose_name="Dept Head Email"
    )
    dept_group_email = models.EmailField(
        blank=True,
        null=True,
        verbose_name="Dept Group Email"
    )

    # Designation Logic
    designation_type = models.CharField(
        max_length=10,
        choices=[('existing', 'Existing'), ('new', 'New')],
        default='existing',
        verbose_name="Designation Type"
    )
    designation_existing = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Existing Designation"
    )
    designation_new = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="New Designation Name"
    )
    designation = models.CharField(  # Final computed value
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Final Designation"
    )

    role_link = models.URLField(
        blank=True,
        null=True,
        verbose_name="Link to Role"
    )
    jd_link = models.URLField(
        blank=True,
        null=True,
        verbose_name="Link to JD"
    )

    # Days & Hiring Plan
    select_joining_days = models.CharField(
        max_length=50,
        verbose_name="Select Joining Days"
    )
    plan_start_sharing_cvs = models.DateField(
        blank=True,
        null=True,
        verbose_name="Plan: Start Sharing CVs"
    )
    planned_interviews_started = models.DateField(
        blank=True,
        null=True,
        verbose_name="Planned: Interviews Started By"
    )
    planned_offer_accepted = models.DateField(
        blank=True,
        null=True,
        verbose_name="Planned: Offer Accepted By"
    )
    planned_joined = models.DateField(
        blank=True,
        null=True,
        verbose_name="Planned: Joining By"
    )

    # Additional Info
    special_instructions = models.TextField(
        blank=True,
        null=True,
        verbose_name="Special Instructions to HR"
    )
    hiring_status = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Hiring Status"
    )

    # CC Emails (list of emails)
    employees_in_cc = models.JSONField(
    default=list,          
    blank=True,
    verbose_name="Employees in CC (list of emails)"
)

    # Checklist Fields
    role_n_jd_exist = models.CharField(
        max_length=3,
        choices=[('Yes', 'Yes'), ('No', 'No')],
        default='Yes',
        verbose_name="Role & JD Exist?"
    )
    role_n_jd_read = models.CharField(
        max_length=3,
        choices=[('Yes', 'Yes'), ('No', 'No')],
        default='Yes',
        verbose_name="Role & JD Read?"
    )
    role_n_jd_good = models.CharField(
        max_length=3,
        choices=[('Yes', 'Yes'), ('No', 'No')],
        default='Yes',
        verbose_name="Role & JD Suitable?"
    )
    days_well_thought = models.CharField(
        max_length=3,
        choices=[('Yes', 'Yes'), ('No', 'No')],
        default='Yes',
        verbose_name="Days Well Thought?"
    )

    # Timestamps (fixes your deployment crash)
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Created At"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At"
    )

    class Meta:
        verbose_name = "Hiring Requisition"
        verbose_name_plural = "Hiring Requisitions"
        ordering = ['-created_at']  # Newest first

    def __str__(self):
        return f"{self.ser or 'New'} - {self.designation or 'No Designation'} ({self.hiring_dept})"

    def save(self, *args, **kwargs):
        if not self.ser:
            today = timezone.now().strftime('%Y%m')
            last = HiringRequisition.objects.filter(ser__startswith=f"HR-{today}").count()
            self.ser = f"HR-{today}-{last + 1:03d}"

        # Auto-compute final designation
        if self.designation_type == 'existing':
            self.designation = self.designation_existing
        else:
            self.designation = self.designation_new

        super().save(*args, **kwargs)