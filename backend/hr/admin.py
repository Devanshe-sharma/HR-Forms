# hr/admin.py

from django.contrib import admin
from django.utils.html import format_html
from django import forms
from decimal import Decimal

from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import (
    Profile, CandidateApplication, Country, State, City,
    JobDesignation, Employee, Contract, ContractBreakdown, Payslip
)


# ==========================
# Import-Export Resources
# ==========================

class ContractResource(resources.ModelResource):
    class Meta:
        model = Contract
        fields = (
            'employee__full_name', 'employee__employee_id', 'employee__email',
            'employee__department', 'employee__designation',
            'contract_type', 'start_date', 'end_date', 'salary', 'is_active',
            'contract_amount', 'contract_period_months',
        )
        export_order = fields


# ==========================
# Inlines
# ==========================

class ContractBreakdownInline(admin.StackedInline):
    model = ContractBreakdown
    can_delete = False
    extra = 0
    verbose_name_plural = "CTC Breakdown (Full-time only)"

    fieldsets = (
        ("Core Salary Components", {
            'fields': (
                'basic_salary',
                ('hra', 'telephonic_allowance'),
                ('travel_allowance', 'supplementary_allowance'),
            ),
            'description': "<small><strong>HRA Tip:</strong> Usually 40% of Basic. Leave blank if not applicable.</small>"
        }),
        ("Employer Contributions", {
            'fields': ('employer_pf', 'employer_esic'),
        }),
        ("Annual Benefits", {
            'fields': ('annual_bonus', 'mediclaim_premium'),
        }),
        ("Auto-Calculated (Read-only)", {
            'fields': ('gross_monthly', 'monthly_ctc', 'gratuity'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ('gross_monthly', 'monthly_ctc', 'gratuity')

    # Optional: Suggest 40% HRA on new entries
    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        class FormWithHRA(formset.form):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                if not self.instance.pk and self.instance.basic_salary:
                    self.fields['hra'].initial = self.instance.basic_salary * Decimal('0.4')
        formset.form = FormWithHRA
        return formset


# ==========================
# Admin Classes
# ==========================

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')


@admin.register(CandidateApplication)
class CandidateApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'full_name', 'email', 'phone', 'designation', 'city', 'state',
        'relocation', 'experience', 'expected_monthly_ctc', 'created_at'
    )
    search_fields = ('full_name', 'email', 'phone', 'designation')
    list_filter = ('designation', 'experience', 'relocation', 'state', 'city', 'created_at')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state')
    list_filter = ('state',)
    search_fields = ('name', 'state__name')


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')
    ordering = ('name',)


@admin.register(JobDesignation)
class JobDesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'jd_link_display')
    search_fields = ('name',)
    ordering = ('name',)

    def jd_link_display(self, obj):
        if obj.jd_link:
            return format_html('<a href="{}" target="_blank">View JD</a>', obj.jd_link)
        return "No JD"
    jd_link_display.short_description = "Job Description"


@admin.register(Employee)
class EmployeeAdmin(ImportExportModelAdmin):
    list_display = ('employee_id', 'full_name', 'email', 'department', 'designation', 'current_salary', 'joining_date')
    list_filter = ('department', 'designation', 'joining_date')
    search_fields = ('full_name', 'employee_id', 'email', 'department')
    ordering = ('-joining_date',)


@admin.register(Contract)
class ContractAdmin(ImportExportModelAdmin):
    resource_class = ContractResource  # Enables Import/Export buttons

    list_display = (
        'employee_link',
        'contract_type',
        'salary_formatted',
        'start_date',
        'end_date',
        'is_active',
        'contract_amount',
        'contract_period_months',
    )
    list_filter = ('contract_type', 'is_active', 'start_date')
    search_fields = ('employee__full_name', 'employee__employee_id')
    date_hierarchy = 'start_date'

    inlines = [ContractBreakdownInline]

    def get_inlines(self, request, obj=None):
        """Show CTC breakdown only for Full-time contracts"""
        if obj and obj.contract_type != 'Full-time':
            return []
        return [ContractBreakdownInline]

    def employee_link(self, obj):
        return format_html(
            '<a href="/admin/hr/employee/{}/change/">{}</a>',
            obj.employee.id, obj.employee.full_name
        )
    employee_link.short_description = "Employee"

    def salary_formatted(self, obj):
        return f"₹{obj.salary:,.0f}"
    salary_formatted.short_description = "Annual CTC"
    salary_formatted.admin_order_field = 'salary'

    # Beautiful breakdown table on detail page
    def breakdown_table(self, obj):
        if not hasattr(obj, 'breakdown') or not obj.breakdown:
            return "<em>No CTC breakdown (not Full-time or not filled)</em>"

        b = obj.breakdown
        table = f"""
        <table style="width:100%; border-collapse: collapse; font-size:14px; margin-top:20px;">
            <thead style="background:#f0f8ff;">
                <tr>
                    <th style="border:1px solid #ccc; padding:10px; text-align:left;">Component</th>
                    <th style="border:1px solid #ccc; padding:10px; text-align:right;">Amount (₹)</th>
                </tr>
            </thead>
            <tbody>
                <tr><td style="padding:8px;"><strong>Basic Salary</strong></td><td style="text-align:right; padding:8px;">{b.basic_salary:,.2f}</td></tr>
                <tr><td style="padding:8px;">HRA</td><td style="text-align:right; padding:8px;">{b.hra:,.2f}</td></tr>
                <tr><td style="padding:8px;">Telephonic Allowance</td><td style="text-align:right; padding:8px;">{b.telephonic_allowance:,.2f}</td></tr>
                <tr><td style="padding:8px;">Travel Allowance</td><td style="text-align:right; padding:8px;">{b.travel_allowance:,.2f}</td></tr>
                <tr><td style="padding:8px;">Supplementary Allowance</td><td style="text-align:right; padding:8px;">{b.supplementary_allowance:,.2f}</td></tr>
                <tr style="background:#f0f8ff;"><td style="padding:10px; font-weight:bold;">Gross Monthly</td><td style="text-align:right; padding:10px; font-weight:bold;">{b.gross_monthly:,.2f}</td></tr>
                <tr><td style="padding:8px;">Employer PF</td><td style="text-align:right; padding:8px;">{b.employer_pf:,.2f}</td></tr>
                <tr><td style="padding:8px;">Employer ESI</td><td style="text-align:right; padding:8px;">{b.employer_esic:,.2f}</td></tr>
                <tr><td style="padding:8px;">Monthly Bonus Portion</td><td style="text-align:right; padding:8px;">{(b.annual_bonus / 12):,.2f}</td></tr>
                <tr style="background:#e6f7ff;"><td style="padding:10px; font-weight:bold;">Monthly CTC</td><td style="text-align:right; padding:10px; font-weight:bold;">{b.monthly_ctc:,.2f}</td></tr>
                <tr><td style="padding:8px;">Gratuity (15/26 × Basic)</td><td style="text-align:right; padding:8px;">{b.gratuity:,.2f}</td></tr>
                <tr><td style="padding:8px;">Mediclaim Premium</td><td style="text-align:right; padding:8px;">{b.mediclaim_premium:,.2f}</td></tr>
                <tr style="background:#fff3cd; font-size:16px;">
                    <td style="padding:15px; font-weight:bold;">Total Annual CTC</td>
                    <td style="text-align:right; padding:15px; font-weight:bold; color:#d63300;">
                        ₹{obj.salary:,.2f}
                    </td>
                </tr>
            </tbody>
        </table>
        """
        return format_html(table)

    breakdown_table.short_description = "Full CTC Breakdown Table"

    readonly_fields = ('breakdown_table',)
    fieldsets = (
        (None, {
            'fields': ('employee', 'contract_type', 'start_date', 'end_date', 'salary', 'is_active')
        }),
        ('Fixed-Term Details (Contract/Intern/Temp)', {
            'fields': ('contract_amount', 'contract_period_months'),
            'classes': ('collapse',),
        }),
        ('CTC Breakdown Summary', {
            'fields': ('breakdown_table',),
        }),
    )


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ('employee_link', 'month', 'file')
    list_filter = ('month',)
    search_fields = ('employee__full_name', 'month')

    def employee_link(self, obj):
        return format_html(
            '<a href="/admin/hr/employee/{}/change/">{}</a>',
            obj.employee.id, obj.employee.full_name
        )
    employee_link.short_description = "Employee"


@admin.register(ContractBreakdown)
class ContractBreakdownAdmin(admin.ModelAdmin):
    list_display = ('contract', 'basic_salary', 'gross_monthly', 'monthly_ctc', 'created_at')
    search_fields = ('contract__employee__full_name',)
    readonly_fields = ('gross_monthly', 'monthly_ctc', 'gratuity', 'created_at', 'updated_at')