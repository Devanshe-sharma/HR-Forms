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

from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import ForeignKeyWidget

from .models import (
    CandidateApplication,
    Country,
    State,
    City,
    JobDesignation,
    Employee,
    Payslip,
    CTCComponent,
    Department,
    Designation,
)


# ────────────────────────────────────────────────
#  CSV Import Form (shared)
# ────────────────────────────────────────────────
class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="CSV file")


# ────────────────────────────────────────────────
# CandidateApplication Admin
# ────────────────────────────────────────────────


@admin.register(CandidateApplication)
class CandidateApplicationAdmin(admin.ModelAdmin):
    # 1. Table Columns (Matches your request: Name, Email, Mobile, Sal, Exp, Loc, Profile, Status)
    list_display = (
        'full_name',
        'email',
        'phone',
        'current_ctc',
        'experience_tag',
        'location',
        'profile_link',
        'status',  # This will be the dropdown in the table
    )

    # 2. Enable HR to change status directly from the list view
    list_editable = ('status',)

    # 3. Filters for easy navigation
    list_filter = (
        'status',
        'designation',
        'experience',
        'relocation',
        'state',
        'city',
        'created_at',
    )

    # 4. Search functionality
    search_fields = (
        'full_name',
        'email',
        'phone',
        'designation',
    )

    readonly_fields = ('created_at', 'updated_at')

    # 5. Detail View Layout (Organized into sections)
    fieldsets = (
        ("Application Status", {
            'fields': ('status',),
            'description': "Current stage of the candidate in the hiring pipeline."
        }),
        ("Personal Info", {
            'fields': ('full_name', 'email', 'phone', 'whatsapp_same', 'dob')
        }),
        ("Location", {
            'fields': ('state', 'city', 'pin_code', 'relocation')
        }),
        ("Job Details", {
            'fields': (
                'designation',
                'highest_qualification',
                'experience',
                ('total_experience', 'current_ctc', 'notice_period'),
                'expected_monthly_ctc'
            )
        }),
        ("Language Proficiency", {
            'fields': (
                ('hindi_read', 'hindi_write', 'hindi_speak'),
                ('english_read', 'english_write', 'english_speak'),
            )
        }),
        ("Social & Video", {
            'fields': ('facebookLink', 'linkedin', 'short_video_url')
        }),
        ("Timestamps", {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    # --- Custom Column Methods ---

    def experience_tag(self, obj):
        """Displays a colored tag for Experience status"""
        if not obj.experience:
            return "—"
        color = "#28a745" if obj.experience == "Yes" else "#ffc107"
        text = "Experienced" if obj.experience == "Yes" else "Fresher"
        return format_html(
            '<span style="color:{}; font-weight:bold;">{}</span>',
            color, text
        )
    experience_tag.short_description = "Experience"

    def location(self, obj):
        """Combines City and State into one column"""
        parts = []
        if obj.city:
            parts.append(obj.city.name)
        if obj.state:
            parts.append(obj.state.name)
        return " • ".join(parts) or "—"
    location.short_description = "Location"

    def profile_link(self, obj):
        """Provides quick links to LinkedIn or Video in the table"""
        links = []
        if obj.linkedin:
            links.append(f'<a href="{obj.linkedin}" target="_blank" title="LinkedIn">🔗 LI</a>')
        if obj.short_video_url:
            links.append(f'<a href="{obj.short_video_url}" target="_blank" title="Video">🎥 Video</a>')
        
        return format_html(" | ".join(links) if links else "No Links")
    profile_link.short_description = "Profile"

    def created_at_formatted(self, obj):
        return obj.created_at.strftime("%d %b %Y") if obj.created_at else "—"
    created_at_formatted.short_description = "Applied On"

    # Optional: CSS to make the status dropdown look cleaner in the table
    class Media:
        css = {
            'all': ('admin/css/forms.css',)
        }

# ────────────────────────────────────────────────
# Simple location models
# ────────────────────────────────────────────────
@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')
    ordering = ('name',)


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    list_filter = ('country',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state')
    list_filter = ('state',)
    search_fields = ('name',)
    ordering = ('name',)


# ────────────────────────────────────────────────
# JobDesignation (assuming this is different from Designation)
# ────────────────────────────────────────────────
@admin.register(JobDesignation)
class JobDesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'jd_link_display')
    search_fields = ('name',)

    def jd_link_display(self, obj):
        if obj.jd_link:
            return format_html('<a href="{}" target="_blank">View JD</a>', obj.jd_link)
        return "—"
    jd_link_display.short_description = "Job Description"


# ────────────────────────────────────────────────
# Payslip
# ────────────────────────────────────────────────
@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'file')
    list_filter = ('month',)
    search_fields = ('employee__full_name', 'employee__employee_id')


# ────────────────────────────────────────────────
# CTCComponent
# ────────────────────────────────────────────────
@admin.register(CTCComponent)
class CTCComponentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'formula', 'order', 'is_active', 'show_in_documents')
    list_editable = ('order', 'is_active', 'show_in_documents')
    list_filter = ('is_active', 'show_in_documents')
    search_fields = ('name', 'code')
    ordering = ('order',)


# ────────────────────────────────────────────────
# Department with import-export
# ────────────────────────────────────────────────
class DepartmentResource(resources.ModelResource):
    parent = resources.Field(
        attribute='parent',
        column_name='Parent Department',
        widget=ForeignKeyWidget(Department, 'name')
    )

    class Meta:
        model = Department
        import_id_fields = ('name',)
        fields = ('name', 'department_type', 'parent', 'dept_page_link', 'dept_head_email', 'dept_group_email')
        skip_unchanged = True
        report_skipped = True


@admin.register(Department)
class DepartmentAdmin(ImportExportModelAdmin):
    resource_class = DepartmentResource

    list_display = ('name', 'department_type', 'dept_head_email', 'parent_display', 'has_children')
    list_filter = ('department_type',)
    search_fields = ('name', 'dept_head_email', 'dept_group_email')
    ordering = ('name',)
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        (None, {'fields': ('name', 'department_type', 'parent')}),
        ('Contact & Links', {'fields': ('dept_head_email', 'dept_group_email', 'dept_page_link')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def parent_display(self, obj):
        return obj.parent.name if obj.parent else "—"
    parent_display.short_description = "Parent"

    def has_children(self, obj):
        return obj.children.exists()
    has_children.boolean = True
    has_children.short_description = "Has children"


# ────────────────────────────────────────────────
# Designation with import-export
# ────────────────────────────────────────────────
class DesignationResource(resources.ModelResource):
    department = resources.Field(
        attribute='department',
        column_name='Department',
        widget=ForeignKeyWidget(Department, 'name')
    )

    class Meta:
        model = Designation
        import_id_fields = ('department', 'name')
        fields = ('department', 'name', 'role_document_link', 'jd_link', 'remarks', 'role_document_text')
        skip_unchanged = True


@admin.register(Designation)
class DesignationAdmin(ImportExportModelAdmin):
    resource_class = DesignationResource

    list_display = ('name', 'department', 'jd_link_display', 'has_remarks')
    list_filter = ('department__department_type', 'department')
    search_fields = ('name', 'department__name')
    ordering = ('department', 'name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        (None, {'fields': ('department', 'name')}),
        ('Documents', {'fields': ('role_document_link', 'jd_link', 'role_document_text')}),
        ('Extra', {'fields': ('remarks',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def jd_link_display(self, obj):
        if obj.jd_link:
            return format_html('<a href="{}" target="_blank">JD</a>', obj.jd_link)
        return "—"
    jd_link_display.short_description = "JD"

    def has_remarks(self, obj):
        return bool(obj.remarks)
    has_remarks.boolean = True
    has_remarks.short_description = "Remarks?"


# ────────────────────────────────────────────────
# Employee Admin – with CSV + import-export
# ────────────────────────────────────────────────
class EmployeeResource(resources.ModelResource):
    class Meta:
        model = Employee
        exclude = ('id',)
        import_id_fields = ('employee_id',)

    def get_instance(self, instance_loader, row):
        employee_id = row.get('employee_id')
        if employee_id:
            try:
                return Employee.objects.get(employee_id=employee_id)
            except Employee.DoesNotExist:
                return None
        return None


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
            path('import-csv/', self.admin_site.admin_view(self.import_csv),
                 name='hr_employee_import_csv'),
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
                        return Decimal(str(val).strip().replace(',', ''))
                    except (InvalidOperation, ValueError):
                        return Decimal('0')

                count = 0
                for row in reader:
                    emp_id = row.get('employee_id')
                    official_email = row.get('Official Email')

                    # Avoid unique constraint violation
                    if official_email:
                        try:
                            existing = Employee.objects.get(official_email=official_email)
                            if existing.employee_id != emp_id:
                                official_email = ''
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
                            'contract_period_months': parse_date(row.get('Contract Period (months)')),
                            'next_sal_review_status': row.get('Next Sal Review Status', ''),
                            'next_sal_review_type': row.get('Next Sal Review Type', ''),
                            'reason_for_sal_review_not_applicable': row.get('Reason for Sal Review Not Applicable', ''),
                            'revision_due_date': parse_date(row.get('Revision Due Date')),
                        }
                    )
                    count += 1

                self.message_user(request, f"Successfully processed {count} employees.")
                return redirect("..")

        form = CsvImportForm()
        context = {
            "form": form,
            "title": "Import Employees from CSV",
            "opts": self.model._meta,
            "app_label": self.model._meta.app_label,
        }
        return render(request, "admin/hr/csv_form.html", context)