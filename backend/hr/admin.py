# hr/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django import forms
from django.shortcuts import redirect, render
from django.urls import path
import csv
from io import TextIOWrapper
from decimal import Decimal, InvalidOperation
from datetime import datetime
from .models import CTCComponent

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


# ========== ImportExport Resource for Employee ==========
class EmployeeResource(resources.ModelResource):
    class Meta:
        model = Employee
        exclude = ('id',)  # exclude Django PK to avoid conflicts

    def get_instance(self, instance_loader, row):
        employee_id = row.get('employee_id')
        if employee_id:
            try:
                return Employee.objects.get(employee_id=employee_id)
            except Employee.DoesNotExist:
                return None
        return None


# ========== CSV Import Form ==========
class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="CSV file")


# ========== Admins for other models ==========
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


# ========== Main Employee Admin with ImportExport + CSV Import ==========
@admin.register(Employee)
class EmployeeAdmin(ImportExportModelAdmin):
    resource_class = EmployeeResource

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

    readonly_fields = (
        'gross_monthly',
        'monthly_ctc',
        'gratuity',
        'annual_ctc',
        'equivalent_monthly_ctc',
        'created_at',
        'updated_at',
    )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-csv/', self.admin_site.admin_view(self.import_csv), name='hr_employee_import_csv'),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        if request.method == "POST":
            form = CsvImportForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = form.cleaned_data['csv_file']
                decoded_file = TextIOWrapper(csv_file.file, encoding='utf-8')
                reader = csv.DictReader(decoded_file)

                def parse_date(val):
                    if not val:
                        return None
                    try:
                        return datetime.strptime(val.strip(), '%Y-%m-%d').date()
                    except ValueError:
                        return None

                def parse_decimal(val):
                    if not val:
                        return Decimal('0')
                    try:
                        return Decimal(str(val).strip())
                    except (InvalidOperation, ValueError):
                        return Decimal('0')

                def parse_int(val):
                    if not val:
                        return None
                    try:
                        return int(val)
                    except ValueError:
                        return None

                count = 0
                for row in reader:
                    emp_id = row.get('employee_id')
                    official_email = row.get('Official Email')

                    # Prevent duplicate official_email conflict
                    if official_email:
                        try:
                            existing_emp = Employee.objects.get(official_email=official_email)
                            if existing_emp.employee_id != emp_id:
                                official_email = None  # avoid unique constraint violation
                        except Employee.DoesNotExist:
                            pass

                    Employee.objects.update_or_create(
                        employee_id=emp_id,
                        defaults={
                            'full_name': row.get('Name', ''),
                            'gender': row.get('Gender', ''),
                            'personal_email': row.get('Personal Email', ''),
                            'mobile': row.get('Mobile', ''),
                            'official_email': official_email or '',
                            'department': row.get('Dept', ''),
                            'designation': row.get('Designation', ''),
                            'employee_category': row.get('Employee Category', ''),
                            'name_of_buddy': row.get('Name of Buddy', ''),
                            'offer_accepted_date': parse_date(row.get('Offer Accepted Date')),
                            'planned_joining_date': parse_date(row.get('Planned Joining Date')),
                            'joining_status': row.get('Joining Status', ''),
                            'exit_status': row.get('Exit Status', 'Active'),
                            'joining_date': parse_date(row.get('Joined Date')),
                            'sal_applicable_from': parse_date(row.get('Sal Applicable From')),
                            'basic': parse_decimal(row.get('Basic')),
                            'hra': parse_decimal(row.get('HRA')),
                            'telephone_allowance': parse_decimal(row.get('Telephone Allowance')),
                            'travel_allowance': parse_decimal(row.get('Travel Allowance')),
                            'childrens_education_allowance': parse_decimal(row.get("Children's Education Allowance")),
                            'supplementary_allowance': parse_decimal(row.get('Supplementary Allowance')),
                            'employer_pf': parse_decimal(row.get('Employer PF')),
                            'employer_esi': parse_decimal(row.get('Employer ESI')),
                            'annual_bonus': parse_decimal(row.get('Annual Bonus')),
                            'annual_performance_incentive': parse_decimal(row.get('Annual Performance Incentive')),
                            'medical_premium': parse_decimal(row.get('Medical Premium')),
                            'medical_reimbursement_annual': parse_decimal(row.get('Medical Reimbursement Annual')),
                            'vehicle_reimbursement_annual': parse_decimal(row.get('Vehicle Reimbursement Annual')),
                            'driver_reimbursement_annual': parse_decimal(row.get('Driver Reimbursement Annual')),
                            'telephone_reimbursement_annual': parse_decimal(row.get('Telephone Reimbursement Annual')),
                            'meals_reimbursement_annual': parse_decimal(row.get('Meals Reimbursement Annual')),
                            'uniform_reimbursement_annual': parse_decimal(row.get('Uniform Reimbursement Annual')),
                            'leave_travel_allowance_annual': parse_decimal(row.get('Leave Travel Allowance Annual')),
                            'contract_amount': parse_decimal(row.get('Contract Amount')),
                            'contract_period_months': parse_int(row.get('Contract Period (months)')),
                            'next_sal_review_status': row.get('Next Sal Review Status', ''),
                            'next_sal_review_type': row.get('Next Sal Review Type', ''),
                            'reason_for_sal_review_not_applicable': row.get('Reason for Sal Review Not Applicable', ''),
                            'revision_due_date': parse_date(row.get('Revision Due Date')),
                        }
                    )
                    count += 1

                self.message_user(request, f"Successfully imported/updated {count} employees from CSV.")
                return redirect("..")

        else:
            form = CsvImportForm()

        context = {
            "form": form,
            "title": "Import Employees from CSV",
            "opts": self.model._meta,
            "app_label": self.model._meta.app_label,
        }
        return render(request, "admin/hr/csv_form.html", context)
    
@admin.register(CTCComponent)
class CTCComponentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'formula', 'order', 'is_active', 'show_in_documents')
    list_editable = ('order', 'is_active', 'show_in_documents')
    list_filter = ('is_active', 'show_in_documents')
    search_fields = ('name', 'code')
    ordering = ('order',)

    # Enable drag-and-drop reordering (optional but nice)
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.order_by('order')