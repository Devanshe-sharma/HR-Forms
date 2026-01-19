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
from .models import CTCComponent, Department, Designation

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


class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="CSV file")



# ========== Admins for other models ==========
@admin.register(CandidateApplication)
class CandidateApplicationAdmin(admin.ModelAdmin):
    # ────────────────────────────────────────────────
    #  List view – which fields appear in the table
    # ────────────────────────────────────────────────
    list_display = (
        'full_name',
        'email',
        'phone',
        'designation',
        'experience_summary',
        'expected_monthly_ctc',
        'location_summary',
        'created_at',
        'status_badge',           # optional – if you add status field later
    )
    
    list_display_links = ('full_name', 'email')
    
    # Makes rows clickable faster
    list_per_page = 25
    
    # ────────────────────────────────────────────────
    #  Search – which fields can be searched
    # ────────────────────────────────────────────────
    search_fields = (
        'full_name',
        'email',
        'phone',
        'designation',
        'highest_qualification',
        'linkedin',
        'facebookLink',
    )
    
    # ────────────────────────────────────────────────
    #  Filters – sidebar filters
    # ────────────────────────────────────────────────
    list_filter = (
        'designation',
        'experience',
        'relocation',
        'state__name',               # if State is ForeignKey
        'city__name',                # if City is ForeignKey
        'created_at',
        'hindi_speak',
        'english_speak',
    )
    
    # ────────────────────────────────────────────────
    #  Ordering & date hierarchy
    # ────────────────────────────────────────────────
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    # ────────────────────────────────────────────────
    #  Fieldsets – organize detail view (change form)
    # ────────────────────────────────────────────────
    fieldsets = (
        ('Personal Information', {
            'fields': (
                'full_name',
                'email',
                'phone',
                'whatsapp_same',
                'dob',
            )
        }),
        ('Location', {
            'fields': (
                'state',
                'city',
                'pin_code',
                'relocation',
            )
        }),
        ('Application Details', {
            'fields': (
                'designation',
                'highest_qualification',
                'experience',
                'total_experience',
                'current_ctc',
                'notice_period',
                'expected_monthly_ctc',
            )
        }),
        ('Language Proficiency', {
            'fields': (
                ('hindi_read', 'hindi_write', 'hindi_speak'),
                ('english_read', 'english_write', 'english_speak'),
            )
        }),
        ('Social & Media', {
            'fields': (
                'facebookLink',
                'linkedin',
                'short_video_url',
            )
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    # ────────────────────────────────────────────────
    #  Read-only fields in detail view
    # ────────────────────────────────────────────────
    readonly_fields = ('created_at', 'updated_at')
    
    # ────────────────────────────────────────────────
    #  Custom methods for better list_display
    # ────────────────────────────────────────────────
    
    @admin.display(description='Experience', ordering='total_experience')
    def experience_summary(self, obj):
        if obj.experience == 'No':
            return "Fresher"
        if obj.total_experience:
            return f"{obj.total_experience} yrs"
        return "Yes (no duration)"
    
    @admin.display(description='Location')
    def location_summary(self, obj):
        parts = []
        if obj.city:
            parts.append(str(obj.city))
        if obj.state:
            parts.append(str(obj.state))
        return " → ".join(parts) or "—"
    
    @admin.display(description='Exp. CTC', ordering='expected_monthly_ctc')
    def expected_monthly_ctc_formatted(self, obj):
        if obj.expected_monthly_ctc:
            return f"₹{obj.expected_monthly_ctc:,}"
        return "—"
    
    # Optional – nice colored badge (if you later add status field)
    @admin.display(description='Status')
    def status_badge(self, obj):
        # Example – customize when you add status
        return format_html(
            '<span style="background:#e0f7fa; color:#006064; padding:4px 8px; border-radius:12px;">New</span>'
        )


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
    

# ────────────────────────────────────────────────────────────────
# Department Resource – explicit mapping for your exact headers
# ────────────────────────────────────────────────────────────────
class DepartmentResource(resources.ModelResource):
    name = resources.Field(attribute='name', column_name='Department')
    dept_page_link = resources.Field(attribute='dept_page_link', column_name='Dept Page Link (BO Internal Site)')
    dept_head_email = resources.Field(attribute='dept_head_email', column_name='Dept Head Email')
    dept_group_email = resources.Field(attribute='dept_group_email', column_name='Dept Group Email')
    parent = resources.Field(
        attribute='parent',
        column_name='Parent Department',
        widget=resources.widgets.ForeignKeyWidget(Department, 'name'),
        default=None
    )
    department_type = resources.Field(attribute='department_type', column_name='Department Type (Delivery or Support)')

    class Meta:
        model = Department
        skip_unchanged = True
        report_skipped = True
        import_id_fields = ('name',)
        fields = ('name', 'dept_page_link', 'dept_head_email', 'dept_group_email', 'parent', 'department_type')

    def before_import_row(self, row, row_result=None, **kwargs):
        parent_name = (row.get('Parent Department') or '').strip()

        if parent_name:
            try:
                parent = Department.objects.get(name=parent_name)
                row['parent'] = parent.pk
            except Department.DoesNotExist:
                row['parent'] = None

                # Only log diff if row_result exists
                if row_result is not None:
                    row_result.diff.append(
                        f"Parent '{parent_name}' not found → set to None"
                    )
        else:
            row['parent'] = None

@admin.register(Department)
class DepartmentAdmin(ImportExportModelAdmin):
    resource_classes = [DepartmentResource]

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

    # Keep your custom import view (optional – can coexist with import-export)
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-csv/', self.admin_site.admin_view(self.import_csv),
                 name='hr_department_import_csv'),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        # ... your existing custom import_csv code remains unchanged ...
        # (you can keep it or remove if you prefer only import-export)
        pass


# ────────────────────────────────────────────────────────────────
# Designation Resource – explicit mapping for your exact headers
# ────────────────────────────────────────────────────────────────
class DesignationResource(resources.ModelResource):
    department = resources.Field(
        attribute='department',
        column_name='Department',
        widget=resources.widgets.ForeignKeyWidget(Department, 'name')  # lookup by department name
    )
    name = resources.Field(
        attribute='name',
        column_name='Designation'
    )
    role_document_link = resources.Field(
        attribute='role_document_link',
        column_name='Role Document Link'
    )
    jd_link = resources.Field(
        attribute='jd_link',
        column_name='JD Link'
    )
    remarks = resources.Field(
        attribute='remarks',
        column_name='Remarks'
    )
    role_document_text = resources.Field(
        attribute='role_document_text',
        column_name='Role Document'
    )

    class Meta:
        model = Designation
        skip_unchanged = True
        report_skipped = False          # show skipped rows with reason
        import_id_fields = ('department', 'name')  # unique together
        fields = (
            'department', 'name', 'role_document_link', 'jd_link',
            'remarks', 'role_document_text'
        )


@admin.register(Designation)
class DesignationAdmin(ImportExportModelAdmin):
    resource_classes = [DesignationResource]

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
    resource_classes = [DesignationResource]

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

    # Optional: keep custom CSV import alongside import-export
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-csv/', self.admin_site.admin_view(self.import_csv),
                 name='hr_designation_import_csv'),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        if request.method == "POST":
            form = CsvImportForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = form.cleaned_data['csv_file']
                file = TextIOWrapper(csv_file.file, encoding='utf-8')
                reader = csv.DictReader(file)

                created = 0
                updated = 0
                skipped = 0
                errors = []

                for row in reader:
                    dept_name = row.get('Department', '').strip()
                    desig_name = row.get('Designation', '').strip()

                    if not dept_name or not desig_name:
                        skipped += 1
                        continue

                    try:
                        department = Department.objects.get(name=dept_name)
                    except Department.DoesNotExist:
                        errors.append(f"Department '{dept_name}' not found for '{desig_name}'")
                        skipped += 1
                        continue

                    obj, is_new = Designation.objects.update_or_create(
                        department=department,
                        name=desig_name,
                        defaults={
                            'role_document_link': row.get('Role Document Link', '').strip() or None,
                            'jd_link': row.get('JD Link', '').strip() or None,
                            'remarks': row.get('Remarks', '').strip(),
                            'role_document_text': row.get('Role Document', '').strip(),
                        }
                    )

                    if is_new:
                        created += 1
                    else:
                        updated += 1

                msg = f"Designations import: {created} created, {updated} updated, {skipped} skipped."
                if errors:
                    msg += "\nErrors:\n" + "\n".join(errors)
                self.message_user(request, msg, level='success' if not errors else 'warning')
                return redirect('..')

        form = CsvImportForm()
        context = {
            'form': form,
            'title': 'Import Designations from CSV',
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        }
        return render(request, 'admin/hr/csv_form.html', context)