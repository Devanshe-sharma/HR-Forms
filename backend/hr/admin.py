from django.contrib import admin
from .models import Profile, CandidateApplication, Country, State, City, JobDesignation, Employee, Contract, Payslip
from django.utils.html import format_html

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

# ✅ NEW — Employee, Contract, Payslip Admin Registration
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'full_name', 'email', 'department', 'designation', 'current_salary', 'joining_date')
    list_filter = ('department', 'designation', 'joining_date')
    search_fields = ('full_name', 'employee_id', 'email', 'department')
    ordering = ('-joining_date',)

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ('employee', 'contract_type', 'salary', 'start_date', 'end_date', 'is_active')
    list_filter = ('contract_type', 'is_active', 'start_date')
    search_fields = ('employee__full_name',)

@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'file')
    list_filter = ('month',)
    search_fields = ('employee__full_name',)