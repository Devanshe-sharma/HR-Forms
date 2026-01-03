# hr/admin.py

from django.contrib import admin
from django.utils.html import format_html

from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import (
    CandidateApplication,
    Country,
    State,
    City,
    JobDesignation,
    Employee,
    Payslip,
)


# ======================================================
# Import-Export for Employee (Your 42-column sheet)
# ======================================================

class EmployeeResource(resources.ModelResource):
    class Meta:
        model = Employee
        fields = (
            'employee_id',
            'full_name',
            'gender',
            'personal_email',
            'mobile',
            'official_email',
            'department',
            'designation',
            'employee_category',
            'name_of_buddy',
            'offer_accepted_date',
            'planned_joining_date',
            'joining_status',
            'exit_status',
            'joining_date',
            'sal_applicable_from',
            'basic',
            'hra',
            'travel_allowance',
            'childrens_education_allowance',
            'supplementary_allowance',
            'employer_pf',
            'employer_esi',
            'annual_bonus',
            'annual_performance_incentive',
            'medical_premium',
            'medical_reimbursement_annual',
            'vehicle_reimbursement_annual',
            'driver_reimbursement_annual',
            'telephone_reimbursement_annual',
            'meals_reimbursement_annual',
            'uniform_reimbursement_annual',
            'leave_travel_allowance_annual',
            'contract_amount',
            'contract_period_months',
            'next_sal_review_status',
            'next_sal_review_type',
            'reason_for_sal_review_not_applicable',
            'revision_due_date',
        )
        export_order = fields


# ======================================================
# Admin Menu (Only what you want)
# ======================================================

@admin.register(CandidateApplication)
class CandidateApplicationAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'phone', 'designation', 'created_at')
    search_fields = ('full_name', 'email')
    list_filter = ('designation', 'created_at')
    ordering = ('-created_at',)


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    search_fields = ('name',)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state')
    list_filter = ('state',)
    search_fields = ('name',)


@admin.register(JobDesignation)
class JobDesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'jd_link_display')
    search_fields = ('name',)

    def jd_link_display(self, obj):
        if obj.jd_link:
            return format_html('<a href="{}" target="_blank">View JD</a>', obj.jd_link)
        return "—"
    jd_link_display.short_description = "Job Description"


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'file')
    list_filter = ('month',)
    search_fields = ('employee__full_name',)


# ======================================================
# Employee Admin — Your Main Onboarding + Salary Master
# ======================================================

@admin.register(Employee)
class EmployeeAdmin(ImportExportModelAdmin):
    resource_class = EmployeeResource  # This gives you the Import button

    list_display = (
        'employee_id',
        'full_name',
        'official_email',
        'department',
        'designation',
        'annual_ctc',
        'employee_category',
        'exit_status',
    )

    list_filter = (
        'department',
        'designation',
        'employee_category',
        'exit_status',
    )

    search_fields = (
        'employee_id',
        'full_name',
        'official_email',
        'personal_email',
        'mobile',
    )

    ordering = ('-joining_date',)

    fieldsets = (
        ("Basic Info", {
            'fields': (
                'employee_id',
                'full_name',
                'official_email',
                'department',
                'designation',
                'joining_date',
            )
        }),
        ("Personal & HR", {
            'fields': (
                'gender',
                'personal_email',
                'mobile',
                'employee_category',
                'name_of_buddy',
                ('offer_accepted_date', 'planned_joining_date'),
                ('joining_status', 'exit_status'),
                'sal_applicable_from',
            )
        }),
        ("Salary Components", {
            'fields': (
                'basic',
                'hra',
                'travel_allowance',
                'childrens_education_allowance',
                'supplementary_allowance',
                'employer_pf',
                'employer_esi',
                'annual_bonus',
                'annual_performance_incentive',
                'medical_premium',
            )
        }),
        ("Reimbursements", {
            'fields': (
                'medical_reimbursement_annual',
                'vehicle_reimbursement_annual',
                'driver_reimbursement_annual',
                'telephone_reimbursement_annual',
                'meals_reimbursement_annual',
                'uniform_reimbursement_annual',
                'leave_travel_allowance_annual',
            ),
            'classes': ('collapse',),
        }),
        ("Contract", {
            'fields': ('contract_amount', 'contract_period_months'),
            'classes': ('collapse',),
        }),
        ("Review", {
            'fields': (
                'next_sal_review_status',
                'next_sal_review_type',
                'revision_due_date',
                'reason_for_sal_review_not_applicable',
            ),
            'classes': ('collapse',),
        }),
        ("Auto-Calculated", {
            'fields': (
                'gross_monthly',
                'monthly_ctc',
                'gratuity',
                'annual_ctc',
                'equivalent_monthly_ctc',
            ),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = (
        'gross_monthly',
        'monthly_ctc',
        'gratuity',
        'annual_ctc',
        'equivalent_monthly_ctc',
        'created_at',
        'updated_at',
    )