import csv
from decimal import Decimal
from datetime import datetime
from hr.models import Employee

print("Starting import...")

with open('employees.csv', newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    rows = list(reader)
    print(f"Found {len(rows)} rows in the file")

    for row in rows:
        if not row.get('Name', '').strip():
            continue

        employee_id = row.get('employee_id', '').strip()
        if not employee_id:
            print(f"Skipping row without employee_id: {row.get('Name')}")
            continue

        print(f"Importing/Updating: {row['Name'].strip()} (ID: {employee_id})")

        def parse_date(date_str):
            if not date_str or not date_str.strip():
                return None
            try:
                return datetime.strptime(date_str.strip(), '%d %b %y').date()
            except:
                try:
                    return datetime.strptime(date_str.strip(), '%d %b %Y').date()
                except:
                    return None

        def to_decimal(val):
            if not val:
                return Decimal('0')
            cleaned = str(val).replace(',', '').strip()
            if not cleaned or cleaned in ['-', '0']:
                return Decimal('0')
            try:
                return Decimal(cleaned)
            except:
                return Decimal('0')

        # Special fix for contract period
        period_str = row.get('Contract Period (months)', '').strip().lower()
        contract_period = None
        if period_str:
            import re
            match = re.search(r'\d+', period_str)
            if match:
                contract_period = int(match.group())

        # Use update_or_create to avoid duplicate error
        obj, created = Employee.objects.update_or_create(
            employee_id=employee_id,
            defaults={
                'full_name': row['Name'].strip(),
                'gender': row.get('Gender', '').strip(),
                'personal_email': row.get('Personal Email', '').strip(),
                'mobile': str(row.get('Mobile', '')).strip(),
                'official_email': row['Official Email'].strip(),
                'department': row.get('Dept', '').strip(),
                'designation': row.get('Designation', '').strip(),
                'employee_category': row.get('Employee Category', '').strip(),
                'name_of_buddy': row.get('Name of Buddy', '').strip(),

                'offer_accepted_date': parse_date(row.get('Offer Accepted Date')),
                'planned_joining_date': parse_date(row.get('Planned Joining Date')),
                'joining_date': parse_date(row.get('Joined Date')),
                'sal_applicable_from': parse_date(row.get('Sal Applicable From')),

                'joining_status': row.get('Joining Status', '').strip(),
                'exit_status': row.get('Exit Status', '').strip() or 'Active',

                'basic': to_decimal(row.get('Basic')),
                'hra': to_decimal(row.get('HRA')),
                'travel_allowance': to_decimal(row.get('Travel Allowance')),
                'childrens_education_allowance': to_decimal(row.get("Children's Education Allowance")),
                'supplementary_allowance': to_decimal(row.get('Supplementary Allowance')),
                'employer_pf': to_decimal(row.get('Employer PF')),
                'employer_esi': to_decimal(row.get('Employer ESI')),
                'annual_bonus': to_decimal(row.get('Annual Bonus')),
                'annual_performance_incentive': to_decimal(row.get('Annual Performance Incentive')),
                'medical_premium': to_decimal(row.get('Medical Premium')),

                'medical_reimbursement_annual': to_decimal(row.get('Medical Reimbursement Annual')),
                'vehicle_reimbursement_annual': to_decimal(row.get('Vehicle Reimbursement Annual')),
                'driver_reimbursement_annual': to_decimal(row.get('Driver Reimbursement Annual')),
                'telephone_reimbursement_annual': to_decimal(row.get('Telephone Reimbursement Annual')),
                'meals_reimbursement_annual': to_decimal(row.get('Meals Reimbursement Annual')),
                'uniform_reimbursement_annual': to_decimal(row.get('Uniform Reimbursement Annual')),
                'leave_travel_allowance_annual': to_decimal(row.get('Leave Travel Allowance Annual')),

                'contract_amount': to_decimal(row.get('Contract Amount')) if row.get('Contract Amount') else None,
                'contract_period_months': contract_period,

                'next_sal_review_status': row.get('Next Sal Review Status', '').strip(),
                'next_sal_review_type': row.get('Next Sal Review Type', '').strip(),
                'reason_for_sal_review_not_applicable': row.get('Reason for Sal Review Not Applicable', '').strip(),
                'revision_due_date': parse_date(row.get('Revision Due Date')),
            }
        )

        action = "Created" if created else "Updated"
        print(f"   → {action} successfully")

print(" All employees processed successfully!")
print("Refresh your dashboard — all real data is now live!")